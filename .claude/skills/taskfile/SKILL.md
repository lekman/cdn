---
name: taskfile
description: Guidelines for writing and maintaining Taskfile (GoTask) automation files. Use when creating or modifying task definitions in .yml files.
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Taskfile Development Guide

This skill provides guidelines for writing and maintaining Taskfile (GoTask) automation files in this project.

## File Structure

Taskfiles are organized by domain:

```
Taskfile.yml              # Root taskfile - includes modules, defines shared vars
tasks/
├── bun.yml               # Core development tasks (build, test, lint)
├── claude.yml            # Claude Code configuration tasks
├── git.yml               # Git operations
├── security.yml          # Security scanning tasks
└── docs.yml              # Documentation generation
```

## Core Principles

### 1. Always Use `silent: true`

Every task must use `silent: true` to prevent Taskfile from echoing the command:

```yaml
tasks:
  example:
    desc: "Example task"
    silent: true # Required
    cmds:
      - echo "This runs silently"
```

### 2. Use Colors, Not Emojis

Use ANSI color codes for visual differentiation. Never use emojis in output.

**Color definitions:**

```bash
GREEN='\033[0;32m'    # Success, progress indicators
YELLOW='\033[0;33m'   # Warnings, aliases
RED='\033[0;31m'      # Errors
BLUE='\033[0;34m'     # Info
CYAN='\033[0;36m'     # Headers, highlights
BOLD='\033[1m'        # Section headers
NC='\033[0m'          # No Color (reset)
```

**Correct usage:**

```bash
echo -e "${GREEN}✓${NC} Task completed"
echo -e "${YELLOW}⚠${NC} Warning: File not found"
echo -e "${RED}✗${NC} Error: Connection failed"
echo -e "${CYAN}Running Security Scans${NC}"
```

**Incorrect usage:**

```bash
echo "✅ Task completed"      # No emojis in echo
echo "🚀 Starting pipeline"   # No emojis in echo
echo "❌ Error occurred"       # No emojis in echo
```

### 3. Idempotent Commands

Tasks should be safe to run multiple times without side effects:

```yaml
tasks:
  setup:
    silent: true
    cmds:
      - |
        # Check before creating
        if [ ! -d ".logs" ]; then
          mkdir -p .logs
          echo -e "${GREEN}✓${NC} Created .logs directory"
        else
          echo -e "${GREEN}✓${NC} .logs directory exists"
        fi
```

### 4. Complex Logic Goes in TypeScript

Move complex business logic to TypeScript scripts executed with Bun:

**In Taskfile:**

```yaml
tasks:
  metrics:
    desc: "View code coverage metrics"
    silent: true
    cmds:
      - |
        bun run src/tasks/coverage-metrics.ts -- --threshold={{.THRESHOLD}}
```

**In TypeScript (`src/tasks/coverage-metrics.ts`):**

```typescript
// All parsing, calculation, formatting logic here
import { parseLcov } from "../utils/coverage";

async function main() {
  // Complex logic belongs here, not in bash
}

main().catch(console.error);
```

### 5. Help Command Format

Each module should have a help command showing available tasks:

```yaml
tasks:
  help:
    desc: "Show available tasks"
    aliases: [h]
    silent: true
    cmds:
      - |
        GREEN='\033[0;32m'
        YELLOW='\033[0;33m'
        BOLD='\033[1m'
        NC='\033[0m'

        echo -e "${BOLD}Module Name${NC}"
        echo ""
        echo "Command                            Alias     Description                              Examples"
        echo "-------------------------------------------------------------------------------------------------------"
        echo -e "  ${GREEN}task module:command${NC}            ${YELLOW}mc${NC}        Description here                         VAR=value"
```

## Task Definitions

### Standard Task Structure

```yaml
tasks:
  task-name:
    desc: "Short description of what the task does"
    aliases: [tn] # Short alias
    silent: true # Always required
    vars:
      THRESHOLD: '{{.THRESHOLD | default "80"}}'
    deps:
      - prerequisite-task # Optional dependencies
    cmds:
      - |
        set -euo pipefail

        # Color codes
        GREEN='\033[0;32m'
        NC='\033[0m'

        echo -e "${GREEN}Running task...${NC}"
```

### Variable Defaults

Always provide sensible defaults for variables:

```yaml
vars:
  THRESHOLD: '{{.THRESHOLD | default "80"}}'
  FIX: '{{.FIX | default "false"}}'
  STRICT: '{{.STRICT | default "false"}}'
```

## Output Formatting

### Progress Indicators

```bash
echo -e "${GREEN}Running:${NC} Command description"
echo -e "${GREEN}✓${NC} Task completed successfully"
echo -e "${YELLOW}⚠${NC} Non-critical issue"
echo -e "${RED}✗${NC} Critical failure"
```

### Section Headers

```bash
echo -e "${CYAN}Section Name${NC}"
echo "---------------"
```

### Tables and Alignment

Use printf for aligned output:

```bash
printf "  %-20s %s\n" "Label:" "Value"
printf "  %-20s %s\n" "Another Label:" "Another value"
```

### Status Indicators

```bash
echo -e "${GREEN}[OK]${NC} Resource created"
echo -e "${RED}[FAIL]${NC} Resource creation failed"
echo -e "${YELLOW}[SKIP]${NC} Resource already exists"
```

## Error Handling

### Fail Fast

Use `set -euo pipefail` for bash scripts:

```yaml
cmds:
  - |
    set -euo pipefail
    # Commands here will fail fast on error
```

### Graceful Degradation

For optional prerequisites, suppress errors:

```bash
task prerequisite 2>/dev/null || true
```

### Error Messages

Always include context in error messages:

```bash
if [ -z "$FILE" ]; then
  echo -e "${RED}Error:${NC} File not specified" >&2
  exit 1
fi
```

## Best Practices

1. **Keep bash scripts short** - If logic exceeds ~50 lines, move to TypeScript
2. **Use variables for repeated values** - Define at task level, not inline
3. **Test idempotency** - Run task twice; second run should succeed without changes
4. **Document with desc** - Every task needs a description
5. **Use aliases** - Short 2-3 character aliases for common tasks
6. **Avoid side effects** - Tasks should not modify global state unexpectedly
7. **Export for scripts** - Pass config via environment variables to child scripts

## Module Integration

### Root Taskfile Includes

```yaml
# Taskfile.yml
includes:
  security:
    taskfile: ./tasks/security.yml
    dir: .
  docs:
    taskfile: ./tasks/docs.yml
    dir: .
```

### Shared Variables

Define in root Taskfile, use in modules:

```yaml
# Root Taskfile.yml
vars:
  PROJECT_NAME: "ai-toolkit"
  BUILD_DIR: "dist"
```

## Examples

### Simple Task

```yaml
tasks:
  build:
    desc: "Build the project"
    aliases: [b]
    silent: true
    cmds:
      - bun run build
```

### Task Delegating to TypeScript

```yaml
tasks:
  metrics:
    desc: "View coverage metrics"
    aliases: [met]
    silent: true
    vars:
      THRESHOLD: '{{.THRESHOLD | default "80"}}'
    cmds:
      - |
        bun run src/tasks/coverage-metrics.ts -- --threshold={{.THRESHOLD}}
```

## Related Skills

- `secureai` - Security scanning CLI (used in security tasks)
- `skill` - Guidelines for creating Claude Code skills
