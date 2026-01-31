# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is also used by the automated code review workflow (`claude-code-review.yml`).

## Project Overview

Edge Cache CDN API (`@lekman/cdn`) — content-addressed image storage and distribution using Cloudflare CDN with Azure backend. Images stored by SHA-256 hash (immutable, no cache invalidation). Metadata extracted asynchronously, stored in Cosmos DB.

## Commands

All commands use [Task](https://taskfile.dev) (`task`) with Bun as the runtime.

```bash
task install          # Install all tools and dependencies (alias: i)
task lint             # Run Biome linting (alias: l)
task format           # Format code with Biome (alias: fmt)
task typecheck        # TypeScript type checking (alias: tc)
task test             # Run tests with Bun (alias: t)
task test:coverage    # Tests with coverage report (alias: cov)
task quality          # Run all quality checks (alias: q)

# Single test file
bun test tests/unit/functions/metadata-extraction.test.ts
```

Pre-commit hooks run `lint` and `typecheck` automatically.

Additional task commands via `@northbridge-security/ai-toolkit`:
- `task git:<command>` — Git operations
- `task json:<command>` — JSON validation
- `task yaml:<command>` — YAML validation
- `task markdown:<command>` — Markdown validation
- `task security:<command>` — Security tools (Semgrep)

## Architecture

This project implements a content-addressed image CDN with the following components:

```
Client → APIM (api.lekman.com/cdn/v1)
           ├─ POST /images    → hash, store blob, create Cosmos doc, queue message
           ├─ GET /images/{h} → read Cosmos doc
           └─ DELETE /images/{h} → invoke Delete Function
                                     ├─ delete blob
                                     ├─ delete Cosmos doc
                                     └─ purge Cloudflare cache

Image delivery: img.lekman.com/{hash} → Cloudflare CDN → Azure Blob Storage

Async: Service Bus → Metadata Extraction Function → update Cosmos doc
```

### Project Structure

```
src/
  functions/           # Azure Functions (TypeScript)
    metadata-extraction/  # Service Bus-triggered: extract image metadata
    delete/               # HTTP-triggered: delete blob + Cosmos + purge Cloudflare
  shared/              # Shared utilities and types
    types.ts           # Domain types (ImageDocument, status values)
    cosmos.ts          # Cosmos DB client helpers
    blob.ts            # Blob Storage client helpers
    cloudflare.ts      # Cloudflare purge API client
infra/                 # Infrastructure as Code
  main.bicep           # Azure resource definitions
  modules/             # Bicep modules per resource
policies/              # APIM policy XML files
  post-images.xml      # Upload policy (hash, store, queue)
  get-image.xml        # Metadata retrieval policy
  delete-image.xml     # Delete routing policy
tests/
  unit/                # Unit tests (mock external dependencies)
  mocks/               # Shared mock implementations
docs/
  requirements/        # PRD and epic documents
  ARCHITECTURE.md      # System design and diagrams
  CONTRIBUTING.md      # Dev setup, task commands, CI/CD
  QA.md                # Test strategy and coverage
  SECURITY.md          # Security policy and threat model
```

### System File Convention

Files with external I/O (Azure SDK, Cloudflare API) MUST use the `*.system.ts` suffix. These are excluded from coverage in `bunfig.toml`.

### Dependency Injection Pattern

Functions MUST accept dependencies through an options/deps object for testability. Do not instantiate SDK clients inside function handlers.

```typescript
// Correct: dependencies injected
export async function handleDelete(
  hash: string,
  deps: { cosmos: ICosmosClient; blob: IBlobClient; cloudflare: ICloudflareClient }
): Promise<DeleteResult> { ... }

// Wrong: client instantiated inside handler
export async function handleDelete(hash: string) {
  const cosmos = new CosmosClient(); // VIOLATION
}
```

## Code Style Rules

Biome enforces formatting and linting (configured in `biome.json`). These rules are non-negotiable:

- Double quotes, semicolons, ES5 trailing commas
- 100 character line width, 2-space indentation
- Imports organized automatically by Biome
- `noUnusedVariables`: error
- `noExplicitAny`: warn (off in tests)
- `noConsole`: warn (off in tests)
- `noNonNullAssertion`: off in tests only

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `metadata-extraction.ts` |
| Interfaces | `I` prefix + PascalCase | `ICosmosClient`, `IBlobClient` |
| Types | PascalCase | `ImageDocument`, `DeleteResult` |
| Functions | camelCase | `extractMetadata`, `handleDelete` |
| Constants | UPPER_SNAKE_CASE | `MAX_IMAGE_SIZE`, `SUPPORTED_CONTENT_TYPES` |

## Testing Rules

This project uses Test-Driven Development (TDD) with Bun's built-in test runner.

### TDD Workflow

Follow the **Red -> Green -> Refactor** cycle:

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to pass the test
3. **REFACTOR**: Improve code while keeping tests green

Every new function MUST have a corresponding test file.

### Coverage Thresholds

Enforced in `bunfig.toml` — CI fails if these drop:

| Metric | Threshold |
|--------|-----------|
| Line | 80% |
| Statement | 80% |
| Function | 60% |

Coverage exclusions:
- `**/*.system.ts` — external I/O (Azure SDK, Cloudflare API)
- `tests/**` — test files

### Test File Rules

- Test files MUST mirror the source path: `src/functions/delete/handler.ts` → `tests/unit/functions/delete/handler.test.ts`
- Tests MUST use mocks for Azure SDK clients and Cloudflare API — no real service calls
- Tests MUST NOT make network calls
- Use `describe()` blocks to group related tests
- Use `test()` (not `it()`) for individual test cases
- Import from `bun:test`: `describe`, `expect`, `test`, `beforeEach`, `mock`

## Security Rules

- No secrets, API keys, or credentials in source code (enforced by Semgrep: `no-secrets-in-code`, `no-hardcoded-credentials`)
- No `console.log` in production code (enforced by Semgrep: `no-console-log-in-production`)
- Cloudflare API tokens MUST be retrieved from Azure Key Vault at runtime
- Azure SDK clients MUST use managed identity, never connection strings in code
- mTLS client certificate validation is handled by APIM, not application code

## Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/). Release-please uses these to generate changelogs and version bumps.

Format: `<type>(<scope>): <description>`

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `refactor` | Code change that is not a fix or feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance (deps, config) |
| `ci` | CI/CD pipeline changes |

## CI Quality Gate

All checks MUST pass before merge to `main`:

| Check | Tool | Criteria |
|-------|------|----------|
| Lint | Biome | Zero errors |
| Typecheck | `tsc --noEmit` | Zero errors |
| Tests | Bun test runner | All pass, coverage thresholds met |
| Security | Semgrep | Zero findings (`p/security-audit`, `p/secrets`, `p/typescript`) |

## Documentation

| Document | Content |
|----------|---------|
| [Architecture](docs/ARCHITECTURE.md) | C4 diagrams, component design, data flow |
| [Contributing](docs/CONTRIBUTING.md) | Dev setup, task commands, CI/CD, release process, PR conventions |
| [QA](docs/QA.md) | Test strategy, TDD workflow, coverage targets |
| [Security](docs/SECURITY.md) | Vulnerability reporting, threat model, CIA triad |
| [Requirements](docs/requirements/EPIC.md) | Product Requirements Document |
