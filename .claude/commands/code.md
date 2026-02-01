Implement a feature from its PRD specification.

## Input

PRD path: $ARGUMENTS

Resolve the PRD file path. The PRD is always under `docs/requirements/`. Accept both formats:
- Full path: `docs/requirements/prd.feature-name.md`
- Short name: `prd.feature-name.md` (prepend `docs/requirements/`)

Read the PRD file. If it does not exist, stop and tell the user.

## Phase 1: Discovery

1. Read the PRD thoroughly — understand the problem, features, WBS, file summary, milestones, and dependencies.
2. Read `AGENTS.md` for architecture rules, code style, testing rules, and security requirements.
3. Read `docs/QA.md` for test strategy, coverage targets, and quality gate criteria.
4. Read `docs/SECURITY.md` for security design practices and constraints.
5. Explore the existing codebase to understand what types, interfaces, mocks, and patterns already exist. Use the Explore agent for this.

## Phase 2: Plan

1. Create an implementation plan at `docs/requirements/plan.<feature-name>.md` that covers:
   - Prerequisites (what already exists, what needs to be created)
   - Phased implementation matching the PRD milestones
   - Concrete tasks with file paths, function signatures, and test cases
   - Dependency graph showing which phases can run in parallel
   - File summary with architecture layer and coverage expectations
2. Commit the plan to the current branch and push.

## Phase 3: Setup

1. Install any new dependencies (`bun add <package>`).
2. Create the directory structure for new source and test files.
3. Run `task quality` (or `bun test && bunx biome check src/ tests/ && bunx tsc --noEmit`) to verify the baseline is green before writing any code.

## Phase 4: Implementation — Parallel Sub-Agents

Identify which phases from the plan can run in parallel. The typical split:

- **Agent A**: Pure utility functions + their tests (no external dependency mocks needed)
- **Agent B**: Handler/business logic + their tests (uses existing mocks for interfaces)

Launch both agents simultaneously using the Task tool with `subagent_type: general-purpose`. Each agent prompt must include:

- The exact file paths to create
- All relevant type definitions, interface signatures, and mock APIs (copy from discovery)
- Library API signatures (from `node_modules/**/*.d.ts`)
- Biome formatting rules: double quotes, semicolons, ES5 trailing commas, 2-space indent, 100 char width
- TypeScript constraints: `verbatimModuleSyntax: true` (use `import type` for type-only imports)
- Testing rules: `bun:test`, use `test()` not `it()`, atomic tests (new mock per `test()` block)
- Instruction to write files AND run tests, fixing any failures before returning

After both agents complete:

1. Read all generated files to verify consistency
2. Run the combined tests: `bun test tests/unit/functions/<feature>/`
3. Fix any integration issues between the two agents' outputs

## Phase 5: System Entry Point

Create the `*.system.ts` entry point file (excluded from coverage):

- Thin wiring only — zero business logic
- Message parsing and dependency instantiation
- If Azure SDK packages are not yet installed (depends on infrastructure PRD), write a compilable version that references the handler and types without importing unavailable packages

## Phase 6: Hardening

Quality and security verification per `docs/QA.md` and `docs/SECURITY.md`.

### 6.1 Lint
```bash
bunx biome check src/ tests/
```
Fix all errors. Zero errors required.

### 6.2 Type Check
```bash
bunx tsc --noEmit
```
Fix all errors. Zero errors required.

### 6.3 Full Test Suite
```bash
bun test tests/unit/
```
All tests must pass. Zero failures. Coverage thresholds from `bunfig.toml`:
- Line: 80%
- Statement: 80%
- Function: 60%

### 6.4 Security Review
Verify against `docs/SECURITY.md` checklist:
- No `console.log` in production code (Semgrep: `no-console-log-in-production`)
- No secrets, API keys, or credentials in source (Semgrep: `no-secrets-in-code`)
- No hardcoded credentials (Semgrep: `no-hardcoded-credentials`)
- All external I/O behind interfaces (`*.system.ts` files)
- Dependency injection used — no SDK clients instantiated in handlers
- Managed identity for Azure services (no connection strings in business logic)

### 6.5 Architecture Review
Verify against `AGENTS.md` clean architecture rules:
- Dependencies point inward (business logic does not import system files)
- Every external dependency has an `I{Name}` interface
- System files (`*.system.ts`) contain only thin wrappers
- Mocks implement their corresponding interface
- Test isolation: mocks scoped to each `test()` block

## Phase 7: Commit and Push

1. Stage all new and modified files (be specific, avoid `git add -A`)
2. Commit with conventional commit format: `feat(<scope>): <description>`
3. Push to the current branch
4. Report summary: files created, test count, coverage numbers, quality gate status
