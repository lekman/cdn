---
name: skill
description: Guidelines for creating Claude Code skill files. Use when creating new skills or modifying existing skill definitions.
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Claude Code Skill Development Guide

This skill provides guidelines for creating and maintaining Claude Code skill files.

## Directory Structure

Skills are stored in `.claude/skills/<skill-name>/SKILL.md`:

```
.claude/
└── skills/
    ├── taskfile/
    │   └── SKILL.md       # Taskfile development guidelines
    ├── secureai/
    │   └── SKILL.md       # SecureAI CLI usage
    └── skill/
        └── SKILL.md       # This file - how to write skills
```

## Required File Format

Every skill requires a `SKILL.md` file with two components:

### 1. YAML Frontmatter

Located between `---` markers at the top:

```yaml
---
name: skill-name
description: What this skill does and when to use it
---
```

### 2. Attribution Comment

Immediately after the frontmatter, include:

```markdown
<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->
```

### 3. Markdown Content

Instructions that Claude follows when the skill is invoked.

## Frontmatter Fields

| Field                      | Required | Description                                                 |
| -------------------------- | -------- | ----------------------------------------------------------- |
| `name`                     | Yes      | Lowercase, hyphens only, max 64 chars                       |
| `description`              | Yes      | When to use the skill - helps Claude decide when to load it |
| `disable-model-invocation` | No       | Set `true` to prevent Claude from auto-invoking             |
| `user-invocable`           | No       | Set `false` to hide from `/` menu                           |
| `allowed-tools`            | No       | Tools Claude can use without permission                     |
| `argument-hint`            | No       | Hint for expected arguments, e.g., `[issue-number]`         |

## Invocation Control

Control who can invoke the skill:

- **Default** - Both user and Claude can invoke
- **`disable-model-invocation: true`** - Only user can invoke (use for deployments, commits)
- **`user-invocable: false`** - Only Claude can invoke (use for background knowledge)

## Complete Example

```markdown
---
name: pr-review
description: Review pull request changes for code quality, security, and best practices. Use when reviewing PRs or before merging.
disable-model-invocation: true
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Pull Request Review

When reviewing a pull request, follow these steps:

## 1. Code Quality

- Check for clear variable names
- Verify functions are focused and small
- Look for code duplication

## 2. Security

- Check for hardcoded secrets
- Verify input validation
- Review authentication logic

## 3. Best Practices

- Ensure tests are included
- Check documentation is updated
- Verify error handling
```

## Skill Locations

| Location | Path                                     | Scope             |
| -------- | ---------------------------------------- | ----------------- |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | All your projects |
| Project  | `.claude/skills/<skill-name>/SKILL.md`   | This project only |

## Best Practices

1. **Clear description** - Help Claude know when to use the skill
2. **Focused scope** - One skill per concern
3. **Actionable instructions** - Tell Claude what to do, not just what to know
4. **Examples** - Include code samples where helpful
5. **No emojis** - Use text formatting instead

## Naming Conventions

- Use lowercase with hyphens: `pr-review`, `code-style`, `api-design`
- Keep names short but descriptive
- Avoid generic names like `helper` or `utils`
