# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, GitHub Copilot, etc.) working with this repository.

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

### Clean Architecture Rules

These rules are non-negotiable. They enforce testability, separation of concerns, and maintainability across the codebase.

#### Architecture Layers

Dependencies point inward. Inner layers MUST NOT depend on outer layers.

```
Business Logic (inner)  — Pure functions, domain logic, validation
  ↓ depends on
Interface (boundary)    — Contracts between layers (I{Name} interfaces)
  ↑ implemented by
System Implementation (outer) — External I/O (*.system.ts files)
```

#### System File Convention

Files with external I/O (Azure SDK, Cloudflare API, file system, network) MUST use the `*.system.ts` suffix. These files:

- Are excluded from coverage in `bunfig.toml`
- MUST contain only thin wrappers around external calls
- MUST NOT contain business logic, validation, or branching
- MUST implement a corresponding interface

```
src/shared/
  blob-interface.ts       # IBlobClient — contract definition
  blob.system.ts          # BlobClient implements IBlobClient — Azure SDK calls
  cloudflare-interface.ts # ICloudflareClient — contract definition
  cloudflare.system.ts    # CloudflareClient implements ICloudflareClient — API calls
```

#### Interface-Based Boundaries

Every external dependency MUST have an interface contract:

- Interface files use `{name}-interface.ts` naming
- Interfaces use `I` prefix: `ICosmosClient`, `IBlobClient`, `ICloudflareClient`
- Business logic depends on the interface, never on the system implementation
- System implementations (`*.system.ts`) implement the interface

#### Dependency Injection

Functions and classes MUST accept dependencies through an options/deps object. Do not instantiate SDK clients inside function handlers.

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

For classes, use constructor injection with an exported singleton default:

```typescript
// In handler.ts (business logic)
import type { IBlobClient } from "./blob-interface";
import { defaultBlobClient } from "./blob.system";

export function createHandler(deps?: { blob: IBlobClient }) {
  const blob = deps?.blob ?? defaultBlobClient;
  // ...
}
```

#### Mock Naming Convention

Mock implementations MUST follow `tests/mocks/{name}-mock.ts` naming and implement the corresponding interface:

```
tests/mocks/
  cosmos-mock.ts      # CosmosClientMock implements ICosmosClient
  blob-mock.ts        # BlobClientMock implements IBlobClient
  cloudflare-mock.ts  # CloudflareClientMock implements ICloudflareClient
```

Mocks MUST support:
- State setup methods (e.g., `setDocument()`, `setBlob()`)
- Failure simulation (e.g., `setShouldFail()`)
- State reset (e.g., `clear()`)

#### Module Folder Organization

When 5 or more related files share a common prefix, group them into a module folder with an `index.ts` barrel export:

```
# Before (flat, 5+ related files):
src/shared/auth-interface.ts
src/shared/auth.system.ts
src/shared/auth-types.ts
src/shared/auth-validator.ts
src/shared/auth-handler.ts

# After (module folder):
src/shared/auth/
  index.ts              # Public API re-exports
  auth-interface.ts
  auth.system.ts
  auth-types.ts
  auth-validator.ts
  auth-handler.ts
```

#### Violation Checklist

Code reviews and automated analysis MUST flag these violations:

| Violation | Rule |
|-----------|------|
| System call in business logic | Extract to `*.system.ts` behind an interface |
| Missing interface for external dep | Create `{name}-interface.ts` with `I{Name}` contract |
| Hardcoded dependency in handler | Accept via deps parameter with DI |
| Business logic in `*.system.ts` | Move logic to a pure module, keep system file thin |
| Mock not implementing interface | Mock class MUST implement `I{Name}` |
| 5+ related files without folder | Group into module folder with `index.ts` |
| API named after vendor/tool | Name by business capability, not implementation (e.g., `ISecretStore` not `IOnePasswordClient`) |
| Shared mock in describe scope | Create new mock instance inside each `test()` block |

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

### Atomic Tests

Tests MUST be isolated and safe for parallel execution. These rules are non-negotiable:

- Create new mock instances inside each `test()` block — never share mocks at `describe` scope via `let`
- Do NOT use `mock.module()` for internal code — use dependency injection instead
- Always pass explicit mock dependencies in tests — never rely on default singleton parameters
- Tests MUST pass both individually (`bun test path/to/file.test.ts`) and in the full suite (`bun test`)

```typescript
// Wrong: shared mock causes race conditions in parallel execution
describe("handler", () => {
  let mockCosmos: CosmosClientMock; // shared across tests
  beforeEach(() => { mockCosmos = new CosmosClientMock(); });
  test("reads doc", async () => { /* uses shared mockCosmos */ });
});

// Correct: isolated mock per test
describe("handler", () => {
  test("reads doc", async () => {
    const mockCosmos = new CosmosClientMock(); // scoped to this test
    mockCosmos.setDocument("abc", testDoc);
    const result = await handleGet("abc", { cosmos: mockCosmos });
    expect(result).toEqual(testDoc);
  });
});
```

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

## GitHub Actions Workflow Rules

All workflow files live in `.github/workflows/`. When creating or modifying workflows, follow these rules:

### Permissions (Mandatory)

Every workflow MUST declare explicit `permissions` to satisfy GitHub Advanced Security (CodeQL) and enforce least-privilege on the `GITHUB_TOKEN`:

- Set **workflow-level** `permissions` to the minimum needed (typically `contents: read`)
- Only elevate at **job-level** when a specific job needs more access
- Never leave `permissions` undeclared — the default token scope is too broad

```yaml
# Workflow-level: restrict all jobs by default
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps: [...]

  deploy:
    runs-on: ubuntu-latest
    # Job-level: elevate only where needed
    permissions:
      contents: read
      id-token: write  # OIDC for cloud auth
    steps: [...]
```

### Common Permission Scopes

| Scope | When to use |
|-------|-------------|
| `contents: read` | Checkout code (all jobs need this) |
| `contents: write` | Push commits or branches |
| `pull-requests: write` | Post PR comments, approve, or merge |
| `issues: write` | Update issues or post comments |
| `id-token: write` | OIDC token exchange (Azure, Claude Code auth) |
| `actions: read` | Read workflow run results |
| `security-events: write` | Upload SARIF to GitHub Code Scanning |

### Current Workflows

| Workflow | File | Permissions Level |
|----------|------|-------------------|
| Continuous Integration | `ci.yml` | Workflow-level: `contents: read` |
| Release | `release.yml` | Job-level: `contents: read` |
| Auto-Release | `auto-release.yml` | Job-level: `contents: read`, `pull-requests: write` |
| Claude Code Review | `claude-code-review.yml` | Job-level: `contents: read`, `pull-requests: write`, `issues: read`, `id-token: write` |
| Claude Code | `claude.yml` | Job-level: `contents: write`, `pull-requests: write`, `issues: write`, `id-token: write`, `actions: read` |

## Documentation

| Document | Content |
|----------|---------|
| [Architecture](docs/ARCHITECTURE.md) | C4 diagrams, component design, data flow |
| [Contributing](docs/CONTRIBUTING.md) | Dev setup, task commands, CI/CD, release process, PR conventions |
| [QA](docs/QA.md) | Test strategy, TDD workflow, coverage targets |
| [Security](docs/SECURITY.md) | Vulnerability reporting, threat model, CIA triad |
| [Requirements](docs/requirements/EPIC.md) | Product Requirements Document |

### Reference Guides

These guides provide patterns, examples, and step-by-step instructions that expand on the hard rules above. Read them when implementing new features or refactoring existing code.

| Guide | Content |
|-------|---------|
| [Clean Architecture](docs/policies/clean-architecture.md) | Language-agnostic clean architecture principles, common patterns (repository, service, gateway, strategy), folder organization |
| [Clean Architecture — TypeScript](docs/policies/clean-architecture-typescript.md) | `*.system.ts` convention, interface-based DI, namespace API pattern, step-by-step refactoring process, coverage configuration |
| [TDD — TypeScript](docs/policies/tdd-typescript.md) | Bun test framework, assertions, async testing, mocking, file system testing, test factories, common pitfalls |
| [TypeScript Patterns](docs/policies/typescript-patterns.md) | Bounded context folder structure, business capability naming, class-based exports, barrel exports, atomic tests, unit vs integration test boundaries |
| [Refactoring — TypeScript](docs/policies/refactoring-typescript.md) | Step-by-step refactoring from mixed concerns to clean boundaries, migration checklist, anti-patterns |
