# Quality Assurance

Test strategy, TDD workflow, and coverage targets for @lekman/cdn.

## Test Philosophy

All business logic is developed using Test-Driven Development (TDD). Tests describe the expected behaviour before the implementation exists. External dependencies (Azure SDK clients, Cloudflare API) are always mocked in unit tests.

## Test Organization

| Location | Purpose | Speed |
| -------- | ------- | ----- |
| `tests/unit/` | Business logic with mocks | < 10ms per test |
| `tests/unit/functions/` | Function handler logic | Mock Azure SDK + Cloudflare |
| `tests/unit/shared/` | Shared utility logic | No dependencies |
| `tests/mocks/` | Shared mock implementations | N/A |

## Coverage Targets

| Code Type | Target | Rationale |
| --------- | ------ | --------- |
| Shared types and validation | 100% | Core business rules must be fully verified |
| Function handlers | 80%+ | Orchestration logic with branching paths |
| System files (`*.system.ts`) | Excluded | External I/O (Azure SDK, Cloudflare API) |

Coverage is configured in `bunfig.toml`:

```toml
[test]
coverage = true
coverageThreshold = { line = 0.8, function = 0.6, statement = 0.8 }
coveragePathIgnorePatterns = [
  "**/*.system.ts",
  "tests/**"
]
```

## TDD Workflow

### 1. Red — Write a Failing Test

```typescript
import { describe, expect, test } from "bun:test";
import { handleDelete } from "../../../src/functions/delete/handler.ts";

describe("handleDelete", () => {
  test("returns 204 after deleting blob, cosmos doc, and purging cache", async () => {
    const mockDeps = {
      blob: { delete: async () => {} },
      cosmos: { delete: async () => {} },
      cloudflare: { purge: async () => ({ success: true }) },
    };

    const result = await handleDelete("LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564", mockDeps);
    expect(result.status).toBe(204);
  });

  test("returns 502 when cloudflare purge fails", async () => {
    const mockDeps = {
      blob: { delete: async () => {} },
      cosmos: { delete: async () => {} },
      cloudflare: { purge: async () => { throw new Error("purge failed"); } },
    };

    const result = await handleDelete("LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564", mockDeps);
    expect(result.status).toBe(502);
  });
});
```

Run the test and confirm it fails:

```bash
bun test tests/unit/functions/delete/handler.test.ts
```

### 2. Green — Write Minimum Code

Write only the code needed to pass the failing test. No extra features, no premature abstractions.

### 3. Refactor — Improve While Green

Improve code structure, naming, and readability. Run the test after each change to confirm it still passes.

## Mocking Strategy

External dependencies are accessed through interfaces. Tests inject mock implementations.

### Rules

- No network calls in unit tests
- No real Azure SDK calls in unit tests
- No real Cloudflare API calls in unit tests
- All external I/O goes through injected interfaces

## Running Tests

```bash
task test                                                    # All unit tests
task test:coverage                                           # With coverage report
bun test tests/unit/functions/delete/handler.test.ts         # Single file
```

## Quality Gate

Every PR must pass all checks before merge. The CI `quality-gate` job enforces this.

| Check | Tool | Passing Criteria |
| ----- | ---- | ---------------- |
| Lint | Biome | Zero errors |
| Type check | TypeScript (`tsc --noEmit`) | Zero errors |
| Unit tests | Bun test runner | All tests pass |
| Coverage | Bun coverage | Line 80%, function 60%, statement 80% |
| Security | Semgrep | Zero findings in `p/security-audit`, `p/secrets` |

Run all checks locally:

```bash
task quality
```

## Key Test Scenarios

### Delete Function

- Deletes blob, Cosmos doc, and purges Cloudflare cache successfully (204)
- Returns 502 when Cloudflare purge fails (blob + Cosmos already deleted)
- Succeeds silently when blob does not exist
- Succeeds silently when Cosmos document does not exist
- Retrieves Cloudflare API token from Key Vault

### Metadata Extraction Function

- Extracts width and height from JPEG image headers
- Extracts width and height from PNG image headers
- Extracts EXIF data when present (DateTimeOriginal, GPS, Make/Model)
- Sets EXIF to null when not present
- Updates Cosmos document with status:ready on success
- Updates Cosmos document with status:failed on extraction failure
- Does not retry on failure

### Shared Utilities

- Hash computation produces correct base64url encoding (43 chars, no padding)
- Content-Type validation accepts supported types and rejects others
- Cosmos document creation sets correct TTL and initial status
