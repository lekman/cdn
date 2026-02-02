---
name: planner
description: Unified planning workflow that detects context and guides you through structured development. Use when starting a new feature, resuming work, or managing PRD-driven task execution with parallel worktrees.
user-invocable: true
argument-hint: [path/to/context.md]
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Planner

Unified planning workflow using native Claude Code task management, PRD validation, and git worktree isolation. No external CLI dependencies.

---

## 1. AI Sandbox Rules

### What You CAN Do (Auto-Approved)

```text
READ any file in the project for context
WRITE to .worktree/** directories (active worktrees)
WRITE to .tmp/** directory (temporary/scratch files)
CREATE/EDIT files in worktrees
RUN read-only git commands (status, log, diff, branch, worktree list)
RUN tests and linters
SEARCH code with grep, glob
CREATE/UPDATE tasks via TaskCreate, TaskUpdate, TaskList, TaskGet
LAUNCH subagents via Task tool for parallel worktree work
```

### What Requires Human Approval

```text
EDIT files outside .worktree/ or .tmp/
DELETE files or directories
MODIFY configuration files (.claude/, .husky/, .vscode/)
EXECUTE destructive bash commands (chmod, rm -r, pkill)
```

### What Is BLOCKED

```text
Push code directly (git push)
Expose GH_TOKEN or secrets in commands
Edit .env files
Read credentials or secret files (see AGENTS.md)
```

---

## 2. Phase 0: Context Detection

### 2.1 Check Current Branch

```bash
git branch --show-current
```

**If on default branch** (main, master, develop, development):

```text
You're on the default branch.

Planning requires a feature branch. Options:
1. Switch to an existing feature branch
2. Create a new branch: git checkout -b feat/<name>

Please switch branches and run /planner again.
```

**STOP HERE if on default branch.** Do not proceed.

### 2.2 Detect Phase

Use three signals to determine the current workflow phase:

**Signal 1: PRD state**

```bash
ls .tmp/prd-draft.md 2>/dev/null
ls docs/requirements/prd.*.md 2>/dev/null
```

**Signal 2: Task state** - Run `TaskList` to check for existing tasks.

**Signal 3: Worktree state**

```bash
git worktree list
```

Check for `.worktree/` entries beyond the main worktree.

**Phase logic:**

| Condition | Phase |
|-----------|-------|
| No tasks AND no finalized PRD in `docs/requirements/` | **INIT** |
| Draft PRD exists in `.tmp/` AND no tasks | **PRD** |
| Tasks exist AND none have status `in_progress` | **START** |
| Tasks `in_progress` OR active worktrees in `.worktree/` | **WORK** |
| All tasks have status `completed` | **DONE** |

### 2.3 Session Recovery

Native Claude Tasks are session-scoped. If `TaskList` returns empty but:

- A finalized PRD exists in `docs/requirements/prd.*.md`
- Worktree branches exist (`git branch --list 'worktree/*'`)

Then **re-create tasks from the PRD**:

1. Read the finalized PRD
2. Parse features and create tasks via `TaskCreate` with TDD dependencies (see Section 4)
3. Check which `worktree/*` branches are already merged into current branch:
   ```bash
   git branch --merged
   ```
4. Mark already-merged tasks as `completed` via `TaskUpdate`

The PRD + git state is the durable source of truth across sessions.

---

## 3. Phase: INIT (No PRD, No Tasks)

### Get Context

**Priority order for gathering requirements:**

1. **Argument provided** (skill invoked with a file path):
   - Read the file
   - Use content as PRD input

2. **Jira-style branch name** (contains pattern like `PROJ-123`, `FEAT-456`):
   - Extract ticket ID from branch name
   - Fetch ticket details via Atlassian MCP:
     ```
     mcp__atlassian__getJiraIssue with issueIdOrKey=[extracted-ticket-id]
     ```
   - If MCP fails, fall back to asking user

3. **No context available**:
   - Ask user to provide requirements:
     ```
     I don't have context for this feature branch.

     Please provide one of:
     - A path to a markdown file with requirements
     - A Jira ticket ID
     - A description of what you're building
     ```

### Create PRD Draft

Once context is gathered, create `.tmp/prd-draft.md` from the template at `.claude/skills/planner/prd-template.md` (see Section 11). Fill in sections from gathered context. Use `[TODO: description of what's needed]` for sections that need user input.

Then proceed to **Phase: PRD**.

---

## 4. Phase: PRD (Draft Exists, No Tasks)

### Check for Existing Draft

```bash
ls -la .tmp/prd-draft.md 2>/dev/null
```

If draft exists, continue refining it. If not, check `docs/requirements/` for existing PRD.

### Validate PRD

Read `.tmp/prd-draft.md` and validate against the rules below. No external tools needed.

#### Required Sections (errors if missing or too short)

| Section | Header pattern | Min length | Fail condition |
|---------|---------------|------------|----------------|
| Problem Statement | `## Problem Statement` or `### Problem Statement` | 100 chars | Missing, under min length, or contains `[TODO` |
| User Personas | `## User Personas` | 50 chars | Missing, under min length, or contains `[TODO` |
| Vision Statement | `## Vision Statement` | 50 chars | Missing, under min length, or contains `[TODO` |
| Core Features | `## Core Features` or `### Core Features` or `## Must Have` | 50 chars | Missing, under min length, or contains `[TODO` |
| Test Strategy | `## Test Strategy` | 100 chars | Missing, under min length, or contains `[TODO` |
| Acceptance Criteria | `## Acceptance Criteria` or `### Acceptance Criteria` | 50 chars | Missing, under min length, or contains `[TODO` |

#### Required Frontmatter

The PRD must start with YAML frontmatter between `---` markers:

```yaml
---
version: 0.1.0
status: draft
ticket: PROJ-123
---
```

| Field | Severity | Rule |
|-------|----------|------|
| `version` | Error | Must be present, semver format (e.g., `0.1.0`) |
| `status` | Error | Must be present (values: `draft`, `review`, `approved`) |
| `ticket` | Warning | Should be present for traceability |

#### Recommended Sections (warnings if missing)

| Section | Header pattern |
|---------|---------------|
| Market Opportunity | `## Market Opportunity` or `### Market Opportunity` |
| Architecture & Design | `## Architecture` or `## Design` |
| Domain Model | `### Domain Model` or `### Bounded Context` |
| Interface Boundaries | `### Interface Boundaries` or `### Input` / `### Output` |
| Security Considerations | `## Security` |
| Risk Mitigation | `### Risk` |

#### Marker Checks

| Marker | Severity | Meaning |
|--------|----------|---------|
| `[TODO` | Error | Unfinished placeholder - must be resolved |
| `?` (the emoji) | Error | Unresolved question - must be answered |

#### Acceptance Criteria Format

Acceptance criteria should use Given/When/Then or numbered AC format:
- `Given [context], when [action], then [result]`
- `AC1:`, `AC2:`, etc.

If neither format is found, emit a warning.

#### Validation Result

Count errors and warnings. Report them grouped by severity.

- **0 errors**: Validation passes. Proceed to finalization.
- **Errors present**: Display all issues. Ask clarifying questions to resolve. Update draft. Re-validate.

After 3 failed attempts with same errors:
- Summarize blocking issues
- Ask user if they want to proceed with warnings only
- Never skip actual errors (missing required sections)

### Finalize PRD

When validation passes:

1. Move PRD to `docs/requirements/`:
   ```bash
   mkdir -p docs/requirements
   cp .tmp/prd-draft.md docs/requirements/prd.<ticket-id>.md
   ```

2. Parse features from the PRD and create tasks using `TaskCreate` with TDD structure.

### Task Creation (TDD Structure)

Parse features from the `## Core Features` section. Each `### Feature N: Title` becomes a feature group. For each feature, create 3 tasks with dependencies:

```
TaskCreate: "[Feature A] Write failing tests" (RED)
  subject: "[Feature A] Write failing tests"
  activeForm: "Writing failing tests for Feature A"

TaskCreate: "[Feature A] Implement to pass tests" (GREEN)
  subject: "[Feature A] Implement to pass tests"
  activeForm: "Implementing Feature A"
  → TaskUpdate: addBlockedBy: [RED task ID]

TaskCreate: "[Feature A] Refactor implementation" (REFACTOR)
  subject: "[Feature A] Refactor implementation"
  activeForm: "Refactoring Feature A"
  → TaskUpdate: addBlockedBy: [GREEN task ID]
```

After creating all tasks, proceed to **Phase: START**.

### Gate Requirements

**STOP** - You MUST complete these steps before proceeding:

1. PRD validated (0 errors)
2. PRD moved to `docs/requirements/`
3. Tasks created via `TaskCreate` with TDD dependencies
4. Verify via `TaskList` that tasks exist

**DO NOT proceed to Phase: START until tasks are created.**

---

## 5. Phase: START (Tasks Exist, None In Progress)

### Show Task Overview

Run `TaskList` and display task summary with statuses and dependencies.

### Group Independent Tasks

Identify tasks that can run in parallel:
- Tasks with no `blockedBy` dependencies (or all blockers completed)
- Tasks that modify different files/directories (no shared paths)

Group these for parallel execution in the WORK phase.

Then proceed to **Phase: WORK**.

---

## 6. Phase: WORK (CodeRabbit Parallel Pattern)

### Autonomous Work Behavior

**Work autonomously without asking for permission.**

Once in WORK phase, implement tasks continuously. Do not stop to ask:
- "Should I proceed with writing the tests?"
- "Ready to implement. Should I continue?"
- "Shall I start the implementation now?"

Only stop at explicit **Decision Points** (see Section 8).

### 6.1 Identify Parallelizable Task Groups

From `TaskList`, find all tasks where:
- Status is `pending`
- `blockedBy` list is empty or all blockers are `completed`
- Tasks touch different files (no overlapping paths)

Group up to 5 independent tasks for parallel execution.

### 6.2 Create Worktrees

For each task group, create a worktree:

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
git worktree add .worktree/task-<ID>-${TIMESTAMP} -b worktree/task-<ID>
```

### 6.3 Launch Parallel Task Subagents

For each worktree, launch a `typescript-agent` via the `Task` tool (up to 5 parallel).

Each subagent prompt MUST include:
- **Working directory**: the worktree path (all file operations use this as root)
- **Task description**: from `TaskGet` for the specific task
- **TDD instructions**: Follow RED/GREEN/REFACTOR cycle
- **QA command**: `cd <worktree-path> && bun run lint && bun run typecheck && bun test`
- **AGENTS.md rules**: security boundaries apply
- **Commit instruction**: commit changes with conventional commit format before finishing

Mark each task as `in_progress` via `TaskUpdate` before launching its subagent.

**Example subagent launch:**

```
Task tool with subagent_type="typescript-agent", prompt:
  "Working directory: /path/to/.worktree/task-3-20260201-143000

   Task: [Feature A] Write failing tests (RED phase)
   Description: <from TaskGet>

   Instructions:
   1. All file reads/writes MUST use the working directory above as root
   2. Follow TDD RED phase: write tests that fail for the expected behavior
   3. Use bun:test for test framework
   4. Follow project conventions from CLAUDE.md
   5. When done, run: cd /path/to/.worktree/task-3-20260201-143000 && bun test
   6. Commit changes: git -C /path/to/.worktree/task-3-20260201-143000 add . && git -C /path/to/.worktree/task-3-20260201-143000 commit -m 'test(scope): description'
   7. Do NOT edit files outside the worktree
   8. Do NOT push, access tokens, or edit .env files"
```

### 6.4 Review Each Completed Worktree

After subagents finish, review each worktree diff:

```bash
git -C .worktree/task-<ID>-<TIMESTAMP> diff HEAD~1
```

Check for:
- Scope creep (changes beyond task description)
- Security violations (secrets, injection vectors)
- Style violations (naming, file organization)
- Missing tests or failing QA

### 6.5 Merge Approved Worktrees

For each reviewed worktree:

```bash
git merge worktree/task-<ID> --no-ff -m "feat(scope): merge task <ID> - <description>"
```

### 6.6 Cleanup Worktrees

```bash
git worktree remove .worktree/task-<ID>-<TIMESTAMP>
git branch -d worktree/task-<ID>
```

After all worktrees for a batch:

```bash
git worktree prune
```

### 6.7 Mark Tasks Completed

For each successfully merged task:

```
TaskUpdate: taskId=<ID>, status="completed"
```

### 6.8 Auto-Continue

After marking tasks complete:

1. Run `TaskList` to find unblocked pending tasks
2. If unblocked tasks exist, repeat from 6.1
3. If no tasks remain, proceed to **Phase: DONE**

**DO NOT ask permission to continue.** The permission model handles governance through tool-level security.

---

## 7. Phase: DONE (All Tasks Complete)

### Final QA

```bash
bun run lint && bun run typecheck && bun test
```

### Summary

```text
All tasks complete!

Branch: [branch-name]
Completed: [N] tasks
PRD: docs/requirements/prd.[ticket-id].md

Ready for pull request. Run:
  /pr - Create PR with generated description
```

---

## 8. Decision Points (When to Stop and Ask)

**Default behavior: Continue working.** Only stop at explicit decision points.

### Continue Automatically When

- Implementation path is clear from PRD/task description
- Tests pass after changes
- Following established patterns in the codebase
- No architectural decisions needed
- Following TDD cycle (RED/GREEN/REFACTOR)
- Quality checks pass

### Stop and Ask ONLY When

- **Multiple valid approaches**: Present 2-4 options with trade-offs using `AskUserQuestion`
- **Unclear requirements**: PRD or task description is ambiguous
- **Security implications**: Auth, crypto, PII handling decisions
- **Breaking changes**: Changes to public APIs or contracts
- **External dependencies**: Blocked by something outside codebase
- **Significant deviation**: Implementation reveals the plan was wrong

### Security Issues - NEVER Auto-Fix

Stop immediately for:
- SQL injection, XSS, injection vulnerabilities
- Authentication/authorization bypasses
- Secrets or credentials in code
- PII exposure risks

---

## 9. Error Recovery

### Session Recovery (Tasks Lost Across Sessions)

If `TaskList` returns empty but work has been done:
1. Check for finalized PRD in `docs/requirements/prd.*.md`
2. Check for worktree branches: `git branch --list 'worktree/*'`
3. Re-create tasks from PRD (see Section 2.3)
4. Mark merged branches as completed

### Merge Conflicts

If merge reports conflicts:
1. List conflicted files
2. Ask user to resolve manually
3. After resolution: `git add <files> && git commit`

### Subagent Failures

If a subagent fails or produces poor output:
1. Review the worktree state
2. Clean up if needed: `git worktree remove .worktree/task-<ID>-<TIMESTAMP> --force`
3. Re-launch with `model: "opus"` parameter for the Task tool
4. If still failing, fall back to sequential (non-parallel) implementation

### Worktree Already Exists

If worktree exists for a different task:
1. Check if previous task was completed
2. If completed but not cleaned up: `git worktree remove <path>` then `git worktree prune`
3. If in progress: continue that task first or ask user

---

## 10. What NOT To Do

- **DO NOT** use any `secureai` CLI commands -- this workflow is self-contained
- **DO NOT** work directly on the feature branch -- use worktrees
- **DO NOT** create tasks without TDD structure (RED/GREEN/REFACTOR)
- **DO NOT** ask permission to continue between tasks
- **DO NOT** launch more than 5 parallel subagents at once

---

## 11. PRD Template

The template file is at `.claude/skills/planner/prd-template.md`.

When creating `.tmp/prd-draft.md`:

1. Read `.claude/skills/planner/prd-template.md`
2. Copy its contents to `.tmp/prd-draft.md`
3. Replace placeholder text in brackets with real content from gathered context
4. Use `[TODO: description of what's needed]` for sections that still need user input
5. Remove sections that genuinely do not apply

---

## Quick Reference

| Situation | Action |
|-----------|--------|
| On wrong branch | Switch to feature branch |
| No PRD | Gather context, create draft in `.tmp/prd-draft.md` using template (Section 11) |
| PRD has errors | Ask questions, refine, re-validate against Section 4 rules |
| PRD valid | Move to `docs/requirements/`, create tasks via `TaskCreate` |
| Tasks ready | Group independent tasks, start WORK phase |
| Tasks in progress | Continue parallel worktree execution |
| Task done | Merge worktree, mark completed, auto-continue |
| All complete | Run final QA, ready for `/pr` |
| Session lost | Re-create tasks from PRD, mark merged ones complete |
