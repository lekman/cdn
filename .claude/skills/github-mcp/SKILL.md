---
name: github-mcp
description: Configure and manage GitHub MCP server with 1Password token management. Use when working with GitHub repositories, issues, pull requests, and workflows.
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# GitHub MCP Setup

Configure the GitHub MCP server to access GitHub repositories, issues, pull requests, and workflows directly from Claude Code using secure token management via 1Password.

**IMPORTANT:** This skill uses 1Password CLI to securely fetch GitHub tokens. Tokens are NEVER hardcoded.

## When to Use This Skill

Use this skill when:

- Setting up MCP server integration for GitHub
- Working with GitHub repositories, issues, or pull requests
- Automating GitHub workflows
- Troubleshooting GitHub MCP connection
- Reauthenticating with different GitHub token
- Configuring organization-specific tokens per repository

## Configuration Scopes

GitHub MCP supports two configuration scopes:

### Global Configuration (User-wide)

- **Config file**: `~/.claude.json`
- **Use when**: Single GitHub account across all projects
- **Token**: Shared across all repositories
- **Command**: `bun .claude/skills/github-mcp/configure-mcp.ts --global`

### Local Configuration (Project-specific)

- **Config file**: `.claude/mcp.json` (gitignored)
- **Use when**: Different GitHub organizations or accounts per repository
- **Token**: Specific to this project only
- **Command**: `bun .claude/skills/github-mcp/configure-mcp.ts --local`
- **Auto-detection**: Script uses local config if `.env` file exists

**Recommended approach**: Use local configuration when working with organization-specific tokens.

## Automated Setup Workflow

When this skill is invoked, follow these steps in order:

### Step 1: Check if MCP Tools Are Available

Attempt to use a GitHub MCP tool:

```text
Use: mcp__github__search_repositories
Input: { "query": "test" }
```

- **If successful**: MCP is ready. Skip to usage section.
- **If fails with "No such tool available"**: Continue to Step 2.

### Step 2: Check if MCP Server Is Configured

Run check to see server status:

```bash
claude mcp list
```

**Possible outcomes:**

**A) Server not listed:**

- Run configuration script: `bun .claude/skills/github-mcp/configure-mcp.ts`
- Script will auto-detect scope (local if `.env` exists, otherwise global)
- Script will prompt for 1Password authentication (30 second timeout)
- Instruct user: "The GitHub MCP server has been configured. Please restart Claude Code with `claude -c` to continue this conversation."
- **STOP HERE** - Wait for user to restart and continue

**B) Server listed with "✓ Connected":**

- MCP should be available but tools aren't loading
- Instruct user: "Please restart Claude Code with `claude -c` to reload MCP servers."
- **STOP HERE** - Wait for user to restart and continue

**C) Server connected but using wrong/expired token:**

- User reports authentication errors or wrong repository access
- Run reauthentication: `bun .claude/skills/github-mcp/configure-mcp.ts --reauth`
- Follow reauthentication workflow (see Reauthentication section below)
- **STOP HERE** - Wait for user to complete reauth flow

### Step 3: Add Global Allow Patterns (Optional)

To avoid permission prompts for GitHub MCP tools:

```bash
bun .claude/skills/github-mcp/configure-mcp.ts --allow-patterns
```

This adds `mcp__github__*` to `~/.claude/settings.json` allowed tools.

### Step 4: Verify Connection

After user restarts, repeat Step 1 to verify tools are now available.

## Prerequisites

### Required: Bun Runtime

Check if installed:

```bash
which bun
```

If not installed:

```bash
curl -fsSL https://bun.sh/install | bash
```

### Required: 1Password CLI

Check if installed:

```bash
which op
```

If not installed:

```bash
brew install 1password-cli
```

### Required: .env File with 1Password Reference

The `.env` file must contain:

```bash
GITHUB_TOKEN=op://Private/GitHub.com/GITHUB_TOKEN
```

**Format:** `op://vault/item/field`

- `vault`: 1Password vault name (e.g., "Private")
- `item`: Item name in vault (e.g., "GitHub.com")
- `field`: Field name (e.g., "GITHUB_TOKEN")

### 1Password Authentication

When running the script, 1Password will prompt for authentication:

- **Timeout:** 30 seconds
- **Action required:** Approve 1Password access request
- **Failure:** Script exits with timeout error

## Available MCP Tools

Once connected, you'll have access to GitHub MCP tools including:

**Repository Operations:**

- `mcp__github__search_repositories` - Search GitHub repositories
- `mcp__github__get_repository` - Get repository details
- `mcp__github__list_commits` - List repository commits
- `mcp__github__get_file_contents` - Read file contents

**Issue Operations:**

- `mcp__github__search_issues` - Search issues across repositories
- `mcp__github__create_issue` - Create new issue
- `mcp__github__update_issue` - Update issue details
- `mcp__github__list_issues` - List repository issues

**Pull Request Operations:**

- `mcp__github__search_pull_requests` - Search pull requests
- `mcp__github__create_pull_request` - Create new PR
- `mcp__github__list_pull_requests` - List repository PRs
- `mcp__github__merge_pull_request` - Merge a PR

**Workflow Operations:**

- `mcp__github__list_workflows` - List GitHub Actions workflows
- `mcp__github__get_workflow_run` - Get workflow run details
- `mcp__github__trigger_workflow` - Trigger workflow dispatch

## Usage Examples

**Search Your Pull Requests (Recommended):**

```typescript
Use: mcp__github__search_pull_requests
Input: { "query": "is:open is:pr author:@me" }
```

**Why use `author:@me`?**

- Searches content created by the authenticated user
- Avoids permission errors when searching specific usernames
- Works across all repositories you have access to

**Search Repositories:**

```typescript
Use: mcp__github__search_repositories
Input: { "query": "language:typescript stars:>1000" }
```

**Search Your Issues:**

```typescript
Use: mcp__github__search_issues
Input: { "query": "is:open is:issue author:@me" }
```

**Create Issue:**

```typescript
Use: mcp__github__create_issue
Input: {
  "owner": "northbridge-security",
  "repo": "ai-toolkit",
  "title": "Bug: Fix data pipeline timeout",
  "body": "Pipeline times out after 5 minutes..."
}
```

**List Pull Requests (Specific Repository):**

```typescript
Use: mcp__github__list_pull_requests
Input: {
  "owner": "northbridge-security",
  "repo": "ai-toolkit",
  "state": "open"
}
```

**Note:** Repository-specific operations (list, create, update) require exact owner/repo names. If repository names are unclear or custom git remotes are used, use search APIs with `author:@me` first to discover accessible repositories.

## Best Practices

### Use Search APIs for Discovery

**Recommended pattern:**

1. Use search APIs with `author:@me` to discover content
2. Extract exact owner/repo names from results
3. Use repository-specific APIs for detailed operations

**Example workflow:**

```typescript
// Step 1: Find your repositories
Use: mcp__github__search_repositories
Input: { "query": "user:@me" }

// Step 2: Use exact names from results
Use: mcp__github__list_pull_requests
Input: {
  "owner": "username",
  "repo": "my-repo",
  "state": "open"
}
```

### Common Search Patterns

**Your open PRs across all repos:**

```text
is:open is:pr author:@me
```

**Your issues assigned to you:**

```text
is:open is:issue assignee:@me
```

**PRs you reviewed:**

```text
is:pr reviewed-by:@me
```

**Recent activity:**

```text
is:pr author:@me updated:>2025-01-01
```

### Avoiding Permission Errors

**Don't use:** `user:my-username` (may fail with 422 validation error)

**Use instead:** `author:@me` (always works for authenticated user)

**Why:** GitHub's search API has different permission models for username searches vs authenticated user searches. Using `@me` ensures the token's permissions are correctly applied.

## Reauthentication

If you need to switch tokens or reauthenticate:

**Run reauthentication script:**

```bash
bun .claude/skills/github-mcp/configure-mcp.ts --reauth
```

This will:

1. Remove existing MCP server configuration
2. Fetch fresh token from 1Password (30 second timeout)
3. Reconfigure server with new token

**After running reauthentication:**

1. Restart Claude Code with `claude -c`
2. GitHub MCP tools should now use new token

**Use cases:**

- Token expired or rotated
- Need to switch between GitHub accounts
- Repository access permissions changed
- Testing with different token scopes

## Troubleshooting

### 1Password CLI Not Found

**Error:** `1Password CLI (op) is not installed`

**Solution:**

```bash
brew install 1password-cli
```

Verify installation:

```bash
op --version
```

### 1Password Authentication Timeout

**Error:** `Timeout: 1Password authentication not completed within 30 seconds`

**Causes:**

- User didn't approve 1Password prompt in time
- 1Password app not running
- 1Password CLI not authenticated

**Solutions:**

1. Ensure 1Password app is running
2. Authenticate 1Password CLI:

   ```bash
   op account list
   op signin
   ```

3. Run configure script again
4. Approve 1Password prompt within 30 seconds

### GITHUB_TOKEN Not Found in .env

**Error:** `GITHUB_TOKEN not found in .env file`

**Solution:**

Create or update `.env` file in project root:

```bash
GITHUB_TOKEN=op://Private/GitHub.com/GITHUB_TOKEN
```

Verify 1Password reference is correct:

```bash
op read op://Private/GitHub.com/GITHUB_TOKEN
```

### Invalid 1Password Reference

**Error:** `1Password CLI failed: [error message]`

**Solutions:**

1. **Check vault name:** Ensure vault exists in 1Password

   ```bash
   op vault list
   ```

2. **Check item name:** Verify item exists in vault

   ```bash
   op item list --vault Private
   ```

3. **Check field name:** Confirm field exists in item

   ```bash
   op item get "GitHub.com" --vault Private
   ```

4. **Test reference directly:**

   ```bash
   op read op://Private/GitHub.com/GITHUB_TOKEN
   ```

### Tools Not Appearing After Configuration

**Solutions:**

1. Verify server shows "✓ Connected" in `claude mcp list`
2. Restart Claude Code completely (not just terminal)
3. Check `~/.claude.json` contains GitHub server config with headers
4. Verify token has correct GitHub API permissions

### "No such tool available" Error

**Solutions:**

1. Run pre-flight check (Step 1)
2. Verify MCP server is configured: `claude mcp list`
3. Check token validity: `op read op://...` and test with GitHub API
4. Restart Claude Code after configuration

### Plain Text Token Warning

**Warning:** `Using plain text token from .env file`

**Risk:** Token stored in plain text, visible to anyone with file access

**Solution:**

Convert to 1Password reference:

1. Store token in 1Password
2. Update .env:

   ```bash
   GITHUB_TOKEN=op://Private/GitHub.com/GITHUB_TOKEN
   ```

3. Run configure script again

## Security Best Practices

1. **NEVER commit .env file** - Add to `.gitignore`
2. **NEVER commit .claude/mcp.json** - Already gitignored, contains tokens
3. **Use 1Password references** - Never plain text tokens
4. **Use local config for org-specific tokens** - Prevents cross-org token leakage
5. **Rotate tokens regularly** - Use `--reauth` after rotation
6. **Limit token scopes** - Grant only necessary permissions
7. **Audit token usage** - Review GitHub token activity logs
8. **Add allow patterns** - Use `--allow-patterns` to avoid accidental permission grants

## Configuration Details

### MCP Server Configuration

The script configures GitHub MCP as a remote HTTP server with bearer token authentication:

**Global configuration (`~/.claude.json`):**

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ghp_xxxxxxxxxxxx"
      }
    }
  }
}
```

**Local configuration (`.claude/mcp.json`):**

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ghp_organization_token"
      }
    }
  }
}
```

**Server Details:**

- **Type:** Remote HTTP MCP server
- **Host:** GitHub-managed (official)
- **Authentication:** Bearer token in Authorization header
- **Endpoint:** `https://api.githubcopilot.com/mcp/`
- **Token Source:** 1Password CLI (`op read`)

### Allow Patterns Configuration

The `--allow-patterns` flag adds GitHub MCP tools to `~/.claude/settings.json`:

```json
{
  "allowedTools": ["mcp__github__*"]
}
```

**Benefits:**

- No permission prompts for GitHub MCP tools
- Faster workflow when using MCP tools frequently
- Consistent experience across sessions

## Related Skills

- `atlassian-mcp` - Atlassian/Jira MCP integration (OAuth-based)
- `secureai-mcp` - SecureAI task management and security controls

## References

- [GitHub MCP Server Repository](https://github.com/github/github-mcp-server)
- [1Password CLI Documentation](https://developer.1password.com/docs/cli/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
