---
name: atlassian-mcp
description: Configure and manage Atlassian MCP server for Jira and Confluence integration. Use when working with Jira tickets or Confluence pages.
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Atlassian MCP Setup

Configure the Atlassian MCP server to access Jira issues and Confluence pages directly from Claude Code.

## When to Use This Skill

Use this skill when:

- Setting up MCP server integration for Atlassian tools
- Working with Jira tickets and issues
- Referencing Confluence documentation
- Troubleshooting Atlassian MCP connection

## Automated Setup Workflow

When this skill is invoked, follow these steps in order:

### Step 1: Check if MCP Tools Are Available

Attempt to use an Atlassian MCP tool:

```text
Use: mcp__atlassian__searchJiraIssuesUsingJql
Input: { "jql": "project = TEST" }
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

- Run configuration script: `bun .claude/skills/atlassian-mcp/configure-mcp.ts`
- Instruct user: "The Atlassian MCP server has been configured. Please restart Claude Code with `claude -c` to continue this conversation."
- **STOP HERE** - Wait for user to restart and continue

**B) Server listed with "⚠ Needs authentication":**

- Continue to Step 3

**C) Server listed with "✓ Connected":**

- MCP should be available but tools aren't loading
- Instruct user: "Please restart Claude Code with `claude -c` to reload MCP servers."
- **STOP HERE** - Wait for user to restart and continue

**D) Server connected but using wrong account:**

- User reports authenticated with wrong Atlassian account
- Run reauthentication: `bun .claude/skills/atlassian-mcp/configure-mcp.ts --reauth`
- Follow reauthentication workflow (see Reauthentication section below)
- **STOP HERE** - Wait for user to complete reauth flow

### Step 3: Guide Authentication

If server shows "⚠ Needs authentication", provide these instructions:

**User must authenticate:**

1. Exit Claude Code completely
2. Run in terminal: `claude /mcp`
3. Select `atlassian` from the list
4. Press Enter to start OAuth flow
5. Complete authentication in browser
6. Restart Claude Code with `claude -c` to continue

**If authentication fails with admin authorization error:**

- Explain that site admin approval is required (see Troubleshooting section)
- Provide message template for user to send to admin
- **STOP HERE** - Wait for admin approval

### Step 4: Verify Connection

After user restarts, repeat Step 1 to verify tools are now available.

## Prerequisites

Bun runtime is required. Check with:

```bash
which bun
```

If not installed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Available MCP Tools

Once connected, you'll have access to:

- `mcp__atlassian__searchJiraIssuesUsingJql` - Search Jira using JQL
- `mcp__atlassian__getJiraIssue` - Fetch specific Jira issue by key
- `mcp__atlassian__createJiraIssue` - Create new Jira issue
- `mcp__atlassian__updateJiraIssue` - Update issue fields
- `mcp__atlassian__addJiraIssueComment` - Add comment to issue
- `mcp__atlassian__getConfluencePage` - Fetch Confluence page
- `mcp__atlassian__searchConfluencePages` - Search Confluence

## Usage Examples

**Search Issues with JQL:**

Use `mcp__atlassian__searchJiraIssuesUsingJql` with JQL query:

```typescript
Use: mcp__atlassian__searchJiraIssuesUsingJql
Input: {
  "jql": "project = PROJ AND status = 'In Progress' ORDER BY updated DESC"
}
```

**Fetch Jira Issue:**

Use `mcp__atlassian__getJiraIssue` with issue key (e.g., `PROJ-123`):

```typescript
Use: mcp__atlassian__getJiraIssue
Input: { "issueKey": "PROJ-123" }
```

**Create Jira Issue:**

```typescript
Use: mcp__atlassian__createJiraIssue
Input: {
  "projectKey": "PROJ",
  "summary": "Implement user authentication",
  "description": "Add JWT-based authentication for API endpoints",
  "issueType": "Story"
}
```

**Get Confluence Page:**

Use `mcp__atlassian__getConfluencePage` with page ID or URL.

## Reauthentication

If you need to switch accounts or reauthenticate with different credentials:

**Run reauthentication script:**

```bash
bun .claude/skills/atlassian-mcp/configure-mcp.ts --reauth
```

This will:

1. Remove existing MCP server (clears stored OAuth tokens)
2. Reconfigure server with fresh settings
3. Prompt you to authenticate with new credentials

**After running reauthentication:**

1. Exit Claude Code
2. Run: `claude /mcp`
3. Select `atlassian` and press Enter
4. Complete OAuth login with NEW account
5. Restart Claude Code with `claude -c`

**Use cases:**

- Logged in with wrong Atlassian account
- Need to switch between multiple Atlassian workspaces
- OAuth tokens expired or corrupted
- Testing with different user permissions

## Troubleshooting

### Admin Authorization Required

If you see: "Your site admin must authorize this app for the site '[organization].atlassian.net'"

**Root cause:** The Atlassian MCP app requires site admin approval before users can connect. Product admins alone are not sufficient—site admin rights are necessary to approve integrations.

**Solution (Site Admin):**

1. **Log in as Site Admin** for [organization].atlassian.net (product admin role is insufficient)
2. Visit [Atlassian Admin Console](https://admin.atlassian.com)
3. Select your organization/site if you manage more than one
4. Navigate to **Apps** → **AI settings** → **Rovo MCP server**
5. Under "Your domains" section, verify allowed domains are configured
6. Ensure **"Allow Atlassian supported domains"** is enabled (toggle should be green/checked)
7. If needed, add specific domains under "Your domains" section
8. The Rovo MCP server enables AI tools (like Claude.ai) to connect to Atlassian apps
   - Access scope: View and Update for Jira work data

**Solution (User):**

Contact your Atlassian site admin (not just product admin) and request they approve "Atlassian MCP" for [organization].atlassian.net.

**Message template to send:**

```
Subject: Request to Enable Rovo MCP Server for [organization].atlassian.net

Hi [Admin Name],

I need access to the Atlassian Rovo MCP server to integrate Jira with Claude.ai development tools.

Could you please enable this? Steps:

1. Log in as Site Admin at https://admin.atlassian.com
2. Select [organization].atlassian.net
3. Navigate to Apps → AI settings → Rovo MCP server
4. Ensure "Allow Atlassian supported domains" is enabled (toggle on)
5. Verify domains are configured under "Your domains" section if needed

This enables AI tools like Claude.ai to access Jira work data (View and Update permissions).

Let me know once enabled. Thanks!
```

Reference: [Atlassian Support - App Authorization Error](https://support.atlassian.com/atlassian-cloud/kb/your-site-admin-must-authorize-this-app-error-in-atlassian-cloud-apps/)

### MCP Server Shows "Disconnected"

1. Run `claude /mcp` in terminal
2. Select `atlassian`
3. Press Enter to trigger OAuth flow
4. Complete authentication in browser

### Tools Not Appearing After Restart

1. Verify `~/.claude.json` contains `atlassian` server config
2. Check OAuth token hasn't expired
3. Re-run authentication flow

### Bun Not Found

Install Bun runtime:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Related Skills

- `github-mcp` - GitHub MCP integration (token-based)
- `secureai-mcp` - SecureAI task management and security controls

## References

- [Atlassian MCP Server Documentation](https://developer.atlassian.com/cloud/mcp/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
