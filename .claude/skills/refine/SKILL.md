---
name: refine
description: Refine early requirements into a validated PRD document. Use when you have a rough idea, Jira ticket, or text description and need to produce a structured PRD suitable for the planner skill.
user-invocable: true
argument-hint: [PROJ-123 or requirement text]
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Refine: Requirements to PRD

Transform early-stage requirements into a validated PRD that the `/planner` skill can execute. Each PRD must be scoped to a single pull request that is independently deployable and brings incremental value.

---

## 1. Gather Context

Determine the input source based on the argument or conversation context.

### 1.1 Ticket Reference Provided (e.g., `PROJ-123`, `TASK-001`, `CDN-42`)

**Step A: Search local docs first**

```bash
grep -rl "<ticket-reference>" docs/ 2>/dev/null
```

Also check for related requirement files:

```bash
ls docs/requirements/ 2>/dev/null
```

If a matching file is found, read it and use as the requirement basis.

**Step B: No local match — try Atlassian MCP**

For Jira-style ticket references (e.g., `PROJ-123`), fetch the ticket using the Atlassian MCP tools. See the `atlassian-mcp` skill for setup and usage.

```text
Use: mcp__atlassian__getJiraIssue
Input: { "issueIdOrKey": "<ticket-reference>", "cloudId": "<cloud-id>" }
```

If the MCP is not configured or the fetch fails, fall back to Step C.

Also search for linked Confluence pages:

```text
Use: mcp__atlassian__getJiraIssueRemoteIssueLinks
Input: { "issueIdOrKey": "<ticket-reference>", "cloudId": "<cloud-id>" }
```

Read any linked Confluence pages for additional context.

**Step C: No match found — ask user**

Use `AskUserQuestion`:

```text
I couldn't find requirements for <ticket-reference> in the docs/ folder or Jira.

Where can I find the requirements?
```

Options:
- **Paste text here** — "I'll describe the requirements in chat"
- **Confluence page** — "It's on a Confluence page (provide URL or page title)"
- **Local file** — "It's in a file (provide path)"
- **Start from scratch** — "Let's define the requirements together"

### 1.2 Requirement Text Provided (in argument or conversation)

Use the provided text directly as the basis for the PRD.

### 1.3 No Argument Provided

Use `AskUserQuestion`:

```text
What feature do you want to refine into a PRD?
```

Options:
- **Jira ticket** — "I have a Jira ticket reference (e.g., PROJ-123)"
- **Description** — "I'll describe what I need"
- **Existing doc** — "I have an existing requirements document (provide path)"

---

## 2. Understand Existing Context

Before drafting, gather project context to scope the PRD correctly.

### 2.1 Read Project Context

Read these files if they exist:

```bash
ls docs/requirements/EPIC.md docs/requirements/roadmap.md docs/ARCHITECTURE.md 2>/dev/null
```

Use the epic, roadmap, and architecture docs to understand:
- Where this feature fits in the product
- What has been built already
- What dependencies exist
- What naming conventions and patterns are used

### 2.2 Check Existing PRDs

```bash
ls docs/requirements/prd.*.md 2>/dev/null
```

Review existing PRDs to:
- Avoid duplicating scope
- Identify shared dependencies
- Follow the same level of detail and structure

---

## 3. Clarify Scope Through Questions

Ask targeted questions using `AskUserQuestion` to fill gaps in the requirements. Group questions by topic and ask in batches (max 4 per round).

### Required Decisions

Ask about each of these until the answer is clear. Skip any that are already answered by the gathered context.

**Scope and boundaries:**

```text
What is the minimum set of functionality needed for this to be useful on its own?
```

Options:
- Suggest 2-3 concrete scope options based on the requirements, ordered from smallest to largest
- Each option must be independently deployable

**Users and triggers:**

```text
Who or what triggers this feature?
```

Options derived from context (e.g., "API consumer", "Scheduled job", "User action in UI", "Another service")

**Success criteria:**

```text
How will we know this feature works correctly?
```

Options:
- "Specific test scenarios" — user provides acceptance criteria
- "Performance targets" — user provides SLAs or KPIs
- "Both"

**Dependencies:**

```text
Does this depend on any features or services that don't exist yet?
```

Options derived from the roadmap/epic context.

### Scope Sizing Rule

Each PRD MUST be sized for a single pull request. Apply these checks:

| Check | Fail condition | Action |
|-------|---------------|--------|
| Feature count | More than 5 core features | Split into multiple PRDs |
| File count estimate | More than 15 new/modified files | Split into multiple PRDs |
| Cross-cutting changes | Touches more than 2 bounded contexts | Split into multiple PRDs |
| Independence | Cannot be deployed without another unreleased PRD | Redefine scope or identify the blocking PRD |

If the scope is too large, propose a split:

```text
This looks too large for a single PR. I suggest splitting into:

1. PRD A: [scope] — can be released independently
2. PRD B: [scope] — depends on PRD A

Should I proceed with PRD A first?
```

Options:
- **Yes, start with PRD A** — "Draft the first PRD"
- **Different split** — "I'd split it differently"
- **Keep as one** — "I accept the larger scope"

---

## 4. Draft the PRD

### 4.1 Create Draft

Read the PRD template:

```bash
cat .claude/skills/planner/prd-template.md
```

Create `.tmp/prd-draft.md` using the template. Fill in all sections from the gathered context and user answers.

Rules for drafting:
- Use `[TODO: description]` for sections that still need input
- Remove sections that do not apply (e.g., `Market Opportunity` for internal tools)
- Follow the naming and structure patterns from existing PRDs in `docs/requirements/`
- Reference the epic/roadmap if this feature is part of a larger plan
- Write acceptance criteria in Given/When/Then or numbered AC format

### 4.2 Scope Validation

Before presenting the draft, verify:

- [ ] The PRD covers a single, independently deployable unit of work
- [ ] Each feature can be tested in isolation
- [ ] No feature depends on unreleased work (unless that PRD is identified as a dependency)
- [ ] The feature brings incremental value — a user or system can benefit from it without waiting for future PRDs
- [ ] MVP over MMP — ship the minimum viable version first, enhance later

### 4.3 Set Frontmatter

```yaml
---
version: 0.1.0
status: draft
ticket: <ticket-reference or "none">
---
```

---

## 5. Present and Iterate

### 5.1 Show the Draft

Present the full `.tmp/prd-draft.md` content to the user. Highlight:
- Any `[TODO]` markers that need their input
- Assumptions you made
- Scope decisions (what's included vs. future enhancements)

### 5.2 Collect Feedback

Use `AskUserQuestion`:

```text
Review the PRD draft above. What changes are needed?
```

Options:
- **Looks good** — "Proceed to validation and planning"
- **Scope changes** — "I want to adjust what's included"
- **Detail needed** — "Some sections need more detail"
- **Start over** — "This isn't what I had in mind"

Iterate on feedback until the user approves.

---

## 6. Hand Off to Planner

Once the user approves the draft, invoke the `planner` skill to:

1. Validate the PRD against the planner's required sections and format rules
2. Move it to `docs/requirements/prd.<ticket-id>.md`
3. Create tasks with TDD structure
4. Begin execution

Invoke with:

```text
/planner .tmp/prd-draft.md
```

---

## 7. Multi-PRD Workflows

When the original requirement is too large and was split in Step 3:

1. Complete the first PRD through the full refine cycle
2. After handing off to `/planner`, note the remaining PRDs
3. When the user is ready, run `/refine` again for the next PRD in the sequence
4. Each subsequent PRD should reference its predecessors in the Dependencies section

---

## Quick Reference

| Situation | Action |
|-----------|--------|
| Ticket reference given | Search docs, then Jira MCP, then ask user |
| Text description given | Use directly as basis |
| No input | Ask user what to refine |
| Scope too large | Propose split into multiple PRDs |
| Gaps in requirements | Ask targeted questions with `AskUserQuestion` |
| Draft ready | Present to user, iterate on feedback |
| User approves | Hand off to `/planner` for validation and execution |
| Multiple PRDs needed | Complete one at a time, each independently deployable |
