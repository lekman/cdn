---
name: coderabbit
description: Extract CodeRabbit review findings for the current repository and generate a triaged markdown report. Use when the user asks about CodeRabbit findings, review issues, or wants to see code review results.
user-invocable: true
---

# CodeRabbit Triage & Fix

Two-phase workflow: triage open findings, then fix accepted ones in parallel worktrees.

The CLI script is at `.claude/skills/coderabbit/coderabbit-report.ts`. All commands are run with `bun`.

## Phase 1: Triage

### Step 1 — Extract open findings

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts extract
```

If the output is `[]`, tell the user "No open CodeRabbit findings for this repository." and **stop**.

### Step 2 — Triage each finding

For each finding in the JSON array, read the referenced source file at the specified lines. Determine one of three actions:

- **outdated** — The code at the referenced location has changed or the issue has been fixed.
- **rejected** — The finding is incorrect, not applicable, or is an acceptable trade-off. Briefly explain why.
- **accepted** — The finding is valid and should be fixed.

Set `action` and `reason` on each finding object.

### Step 3 — Ask the user for confirmation

Use **AskUserQuestion** to confirm each finding's triage action. Batch minor/info findings together. Ask individually for critical/major findings.

Options per finding: **Accept** / **Reject** / **Outdated**

Update `action` and `reason` based on user responses.

### Step 4 — Dismiss outdated and rejected findings

For each finding where `action` is `"outdated"` or `"rejected"`:

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts dismiss <commentId>
```

### Step 5 — Generate the report

Write the triaged findings JSON to `/tmp/claude/coderabbit-triaged.json`, then pipe to the report command:

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts report < /tmp/claude/coderabbit-triaged.json
```

### Step 6 — Open the report

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts open .tmp/coderabbit.md
```

### Step 7 — Ask to proceed

Use **AskUserQuestion**:

- **Proceed with fixes** — Continue to Phase 2
- **Re-triage** — Go back to Step 2
- **Done** — Stop here

## Phase 2: Fix

Only reached when the user chooses "Proceed with fixes".

### Step 8 — QA discovery

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts qa-discovery
```

Save the output — it contains the quality/test/lint/security commands for the repo.

### Step 9 — Group findings

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts group < /tmp/claude/coderabbit-triaged.json
```

This outputs a JSON array of `{ groupId, files, findings }[]`. Each file appears in exactly one group (no merge conflicts).

### Step 10 — Fix each group in parallel

For each group (up to 5 parallel):

1. Write the group JSON to `/tmp/claude/coderabbit-group-N.json`
2. Create a worktree:
   ```bash
   bun .claude/skills/coderabbit/coderabbit-report.ts worktree create fix/coderabbit-N --context /tmp/claude/coderabbit-group-N.json
   ```
3. Launch a **Task subagent** (model: sonnet, subagent_type: typescript-agent) with this prompt:

   > Working directory: `<worktree path>`
   >
   > Read `.tmp/coderabbit-fix-context.json` for the findings to fix.
   > Read `AGENTS.md` first and follow all rules.
   >
   > For each finding:
   > - Apply the fix per `codegenInstructions` or the comment description
   > - Run the QA command after each fix: `<qualityCommand from step 8>`
   > - Commit with `fix(<scope>): <description>` format
   >
   > If `bun` is not found: `curl -fsSL https://bun.sh/install | bash`

### Step 11 — Review each worktree

For each completed worktree:

```bash
git -C <worktree-path> diff <base>..HEAD
```

Check for: security issues, scope creep, style violations.

If the diff has problems, provide feedback and relaunch the subagent. Use Opus model on repeated failure.

### Step 12 — Merge

For each approved worktree branch:

```bash
git merge fix/coderabbit-N --no-ff
```

### Step 13 — Cleanup

For each worktree:

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts worktree remove fix/coderabbit-N
```

### Step 14 — Resolve fixed findings

For each finding that was successfully fixed:

```bash
bun .claude/skills/coderabbit/coderabbit-report.ts resolve <commentId>
```

### Step 15 — Final QA

Run the full quality command in the main repo:

```bash
<qualityCommand from step 8>
```

### Step 16 — Summary

Tell the user:
- How many findings were fixed
- How many failed (if any)
- QA pass/fail status
- List of branches merged
