# Implementation Plan: Delete Pipeline

**PRD:** `prd.delete-pipeline.md`
**Branch:** `claude/delete-pipeline-feature-kwqgA`
**Date:** 2026-02-01

---

## Prerequisites

### Already Exists
- `src/shared/types.ts` — `DeleteResult` interface (`{ status: number; error?: string }`)
- `src/shared/cosmos-interface.ts` — `ICosmosClient` with `delete(id: string): Promise<void>`
- `src/shared/blob-interface.ts` — `IBlobClient` with `delete(hash: string): Promise<void>`
- `src/shared/cloudflare-interface.ts` — `ICloudflareClient` with `purge(url: string): Promise<void>` + `CloudflarePurgeError`
- `src/shared/constants.ts` — `CDN_BASE_URL`, `isValidHash()`
- `tests/mocks/cosmos-mock.ts` — `CosmosClientMock` implements `ICosmosClient`
- `tests/mocks/blob-mock.ts` — `BlobClientMock` implements `IBlobClient`
- `tests/mocks/cloudflare-mock.ts` — `CloudflareClientMock` implements `ICloudflareClient`

### Needs to Be Created
| File | Layer | Coverage |
|------|-------|----------|
| `src/functions/delete/handler.ts` | Business Logic | Included (≥ 80%) |
| `tests/unit/functions/delete/handler.test.ts` | Tests | Excluded |
| `src/functions/delete/index.system.ts` | Framework/Driver | Excluded (`*.system.ts`) |
| `policies/delete-image.xml` | Infrastructure | N/A |

---

## Phase 1: Handler + Tests (Parallelizable)

### Agent A: Delete Handler (`src/functions/delete/handler.ts`)

**Function signature:**
```typescript
import type { IBlobClient } from "../../shared/blob-interface";
import type { ICloudflareClient } from "../../shared/cloudflare-interface";
import type { ICosmosClient } from "../../shared/cosmos-interface";
import type { DeleteResult } from "../../shared/types";

export interface DeleteDeps {
  cosmos: ICosmosClient;
  blob: IBlobClient;
  cloudflare: ICloudflareClient;
}

export async function handleDelete(hash: string, deps: DeleteDeps): Promise<DeleteResult>;
```

**Business logic:**
1. Delete blob from storage (`deps.blob.delete(hash)`) — catch "not found", continue
2. Delete Cosmos document (`deps.cosmos.delete(hash)`) — catch "not found", continue
3. Purge Cloudflare cache (`deps.cloudflare.purge(`${CDN_BASE_URL}/${hash}`)`)
4. If Cloudflare purge throws → return `{ status: 502, error: message }`
5. If all succeed → return `{ status: 204 }`

### Agent A: Tests (`tests/unit/functions/delete/handler.test.ts`)

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | All three operations succeed | `{ status: 204 }` |
| 2 | `blob.delete` called with correct hash | Mock receives hash argument |
| 3 | `cosmos.delete` called with correct hash | Mock receives hash argument |
| 4 | `cloudflare.purge` called with `CDN_BASE_URL/{hash}` | Mock receives correct URL |
| 5 | `blob.delete` throws "not found" | Handler catches, continues, returns 204 |
| 6 | `cosmos.delete` throws "not found" | Handler catches, continues, returns 204 |
| 7 | Cloudflare purge fails | `{ status: 502, error: "..." }` |
| 8 | Blob + Cosmos deleted even when Cloudflare fails | Verify blob.delete and cosmos.delete called |
| 9 | Cloudflare URL includes CDN_BASE_URL | Verify URL format `https://img.lekman.com/{hash}` |

---

## Phase 2: System Entry Point

**File:** `src/functions/delete/index.system.ts`
- Parse `{hash}` from HTTP request route parameter
- Instantiate real deps (placeholder — Azure SDK not installed)
- Call `handleDelete(hash, deps)`
- Map `DeleteResult` → HTTP response (204 empty body, 502 JSON error)

---

## Phase 3: APIM Policy

**File:** `policies/delete-image.xml`
- Extract `{hash}` from URL path
- Validate hash format (43-char base64url)
- Route to Delete Function backend via `<set-backend-service>`
- Pass through Function response (204, 502)

---

## Dependency Graph

```
Phase 1 (Handler + Tests) ──→ Phase 2 (System Entry Point)
                          ──→ Phase 3 (APIM Policy) [independent]
```

Phase 1 is a single unit (handler and tests written together via TDD).
Phases 2 and 3 can run in parallel after Phase 1.

---

## File Summary

| File | Architecture Layer | Coverage | Phase |
|------|-------------------|----------|-------|
| `src/functions/delete/handler.ts` | Application Business Rule | ≥ 80% line | 1 |
| `tests/unit/functions/delete/handler.test.ts` | Tests | Excluded | 1 |
| `src/functions/delete/index.system.ts` | Framework/Driver | Excluded | 2 |
| `policies/delete-image.xml` | Infrastructure | N/A | 3 |
