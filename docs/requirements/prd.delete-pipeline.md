# PRD: Delete Pipeline (DELETE /images/{hash})

**Version:** 1.0
**Author:** Claude Code
**Date:** 31 January 2026
**Status:** Draft
**Epic Reference:** EPIC.md — Epic 4 (Stories 4.1, 4.2)
**Priority:** P1

---

## Background

### Problem Statement

The CDN API needs a delete endpoint that synchronously removes an image from all three storage locations: Azure Blob Storage, Cosmos DB, and Cloudflare CDN cache. The delete operation is split between an APIM routing policy (Story 4.2) and an Azure Function handler (Story 4.1) because APIM cannot directly call the Cloudflare API with Key Vault-sourced tokens.

### System Context

The delete pipeline follows clean architecture principles. The Azure Function handler contains business logic that orchestrates three external operations via injected dependencies. The APIM policy routes the request to the Function and passes through the response.

```
Client → APIM (DELETE /images/{hash})
           └─ Route to Delete Function
                ├─ Delete blob from storage
                ├─ Delete document from Cosmos DB
                ├─ Purge Cloudflare cache
                │   ├─ Success → 204 No Content
                │   └─ Failure → 502 Bad Gateway
                └─ Return response
```

### Dependencies

- **Depends on:** PRD 1 (Shared Domain — types, interfaces, mocks), PRD 2 (Infrastructure — all resources)
- **Depended on by:** Nothing (terminal operation)

---

## Objectives

### SMART Goals

- **Specific:** Implement the Delete Function handler and APIM routing policy
- **Measurable:** 100% test coverage on handler business logic; correct 204/404/502 responses
- **Achievable:** Function handler with DI; APIM pass-through policy
- **Relevant:** Enables complete image lifecycle management (upload, read, delete)
- **Time-bound:** Deployable after infrastructure and shared domain layer

### Key Performance Indicators

| KPI | Target |
|-----|--------|
| Handler test coverage (line) | ≥ 80% |
| Handler test coverage (function) | ≥ 60% |
| Correct 204 response | All three backends cleaned |
| Correct 502 response | Cloudflare purge failure with storage already deleted |
| Correct 404 response | Non-existent image |

---

## Features

### Feature 1: Delete Function Handler (Story 4.1)

HTTP-triggered Azure Function that deletes blob, Cosmos document, and purges Cloudflare cache.

### Feature 2: APIM Delete Policy (Story 4.2)

APIM policy that routes DELETE requests to the Function App backend.

---

## Work Breakdown Structure

### WBS 1: Delete Handler Interface Design

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 1.1 | Define `DeleteDeps` interface | Interface Adapter | `{ cosmos: ICosmosClient; blob: IBlobClient; cloudflare: ICloudflareClient }` |
| 1.2 | Define handler function signature | Application Business Rule | `handleDelete(hash: string, deps: DeleteDeps): Promise<DeleteResult>` |

**Files:**
- `src/functions/delete/handler.ts` — Function signature and types (will contain implementation in later WBS)

---

### WBS 2: Delete Handler — TDD Implementation

Following Red → Green → Refactor for each test case.

| Task | Test Case (RED) | Implementation (GREEN) | Acceptance Criteria |
|------|----------------|----------------------|-------------------|
| 2.1 | Test: returns 204 when all three operations succeed | Implement: call `blob.delete()`, `cosmos.delete()`, `cloudflare.purge()`, return `{ status: 204 }` | AC5: Returns 204 on success |
| 2.2 | Test: calls blob.delete with correct hash | Verify mock receives expected hash argument | AC2: Function deletes blob from storage |
| 2.3 | Test: calls cosmos.delete with correct hash | Verify mock receives expected hash argument | AC3: Function deletes document from Cosmos |
| 2.4 | Test: calls cloudflare.purge with correct URL | Verify mock receives `https://img.lekman.com/{hash}` | AC4: Function calls Cloudflare purge API |
| 2.5 | Test: blob.delete succeeds silently when blob not found | Configure mock to throw "not found"; handler catches and continues | AC2: Succeeds silently if not exists |
| 2.6 | Test: cosmos.delete succeeds silently when doc not found | Configure mock to throw "not found"; handler catches and continues | AC3: Succeeds silently if not exists |
| 2.7 | Test: returns 502 when Cloudflare purge fails | Configure cloudflare mock to throw; handler returns `{ status: 502, error: "..." }` | AC6: Returns 502 if Cloudflare purge fails |
| 2.8 | Test: blob and Cosmos are still deleted when Cloudflare fails | Verify blob.delete and cosmos.delete were called before Cloudflare error | AC6: Storage/Cosmos deleted despite purge failure |
| 2.9 | Test: Cloudflare API token retrieved from Key Vault | Verify deps.cloudflare uses token from Key Vault (mock) | AC7: Token retrieved from Key Vault |

**Architecture Notes:**
- Handler is a **pure business logic function** — no Azure SDK imports
- All I/O delegated to injected `deps` object
- Handler file is NOT a `*.system.ts` file — it contains testable logic
- Order of operations: blob delete → Cosmos delete → Cloudflare purge (storage cleaned before external API call)

**Files:**
- `src/functions/delete/handler.ts` — Business logic implementation
- `tests/unit/functions/delete/handler.test.ts` — All test cases from above

---

### WBS 3: Delete Function Entry Point (`*.system.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 3.1 | Create Azure Function HTTP trigger binding | Framework/Driver | `function.json` with HTTP trigger, route: `images/{hash}`, method: DELETE |
| 3.2 | Create system entry point | Framework/Driver | Instantiate real `ICosmosClient`, `IBlobClient`, `ICloudflareClient` implementations; pass to `handleDelete()` |
| 3.3 | Parse hash from request path | Framework/Driver | Extract `{hash}` from Azure Function route parameter |
| 3.4 | Map `DeleteResult` to HTTP response | Framework/Driver | `status: 204` → empty body; `status: 502` → JSON error body |

**Architecture Notes:**
- This IS a `*.system.ts` file — excluded from coverage
- Contains zero business logic — only wiring
- Real service clients instantiated here using managed identity

**Files:**
- `src/functions/delete/index.system.ts` — Azure Function entry point (coverage excluded)

---

### WBS 4: System Client Implementations

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 4.1 | Implement `CosmosClientSystem` | Framework/Driver | Implements `ICosmosClient` using `@azure/cosmos` SDK with managed identity |
| 4.2 | Implement `BlobClientSystem` | Framework/Driver | Implements `IBlobClient` using `@azure/storage-blob` SDK with managed identity |
| 4.3 | Implement `CloudflareClientSystem` | Framework/Driver | Implements `ICloudflareClient` using `fetch()` to Cloudflare API; token from Key Vault |

**Architecture Notes:**
- All files use `*.system.ts` suffix — excluded from coverage
- Thin wrappers — no business logic
- Each implements the corresponding interface from PRD 1

**Files:**
- `src/shared/cosmos.system.ts` — Cosmos DB SDK wrapper
- `src/shared/blob.system.ts` — Blob Storage SDK wrapper
- `src/shared/cloudflare.system.ts` — Cloudflare API wrapper (includes Key Vault token retrieval)

---

### WBS 5: APIM Delete Policy (Story 4.2)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 5.1 | Extract `{hash}` from URL path | Parse from `/cdn/v1/images/{hash}` |
| 5.2 | Route to Delete Function backend | `<set-backend-service>` pointing to Function App URL |
| 5.3 | Forward hash as path parameter | Preserve `/{hash}` in backend request URL |
| 5.4 | Pass through Function response | Forward status code (204, 404, 502) and body |

**Acceptance Criteria (EPIC AC — Story 4.2):**
- AC1: Policy routes to Delete Function URL
- AC2: Policy passes through function response code

**Files:**
- `policies/delete-image.xml` — APIM routing policy

---

## File Summary

| File | Layer | Coverage |
|------|-------|----------|
| `src/functions/delete/handler.ts` | Business Logic | Included (≥ 80% line) |
| `src/functions/delete/index.system.ts` | Framework/Driver | Excluded (`*.system.ts`) |
| `src/shared/cosmos.system.ts` | Framework/Driver | Excluded (`*.system.ts`) |
| `src/shared/blob.system.ts` | Framework/Driver | Excluded (`*.system.ts`) |
| `src/shared/cloudflare.system.ts` | Framework/Driver | Excluded (`*.system.ts`) |
| `tests/unit/functions/delete/handler.test.ts` | Tests | Excluded (test file) |
| `policies/delete-image.xml` | Infrastructure | N/A |

---

## Milestones

| Phase | Deliverables | Dependencies |
|-------|-------------|-------------|
| Phase 1 | Handler interface design (WBS 1) | PRD 1 (interfaces defined) |
| Phase 2 | Handler TDD implementation (WBS 2) | Phase 1 + PRD 1 (mocks available) |
| Phase 3 | System client implementations (WBS 4) | PRD 1 (interfaces) + PRD 2 (resources deployed) |
| Phase 4 | Function entry point wiring (WBS 3) | Phases 2–3 |
| Phase 5 | APIM policy (WBS 5) | PRD 2 (APIM + Function App deployed) |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Partial delete (blob deleted, Cloudflare purge fails) | Documented behavior (EPIC AC6: 502 response); Cloudflare cache expires naturally via TTL |
| Key Vault token retrieval latency | Cache token in memory with TTL; refresh on 401 |
| Concurrent delete and upload of same hash | Content-addressed — delete removes current; re-upload creates new identical content |
| Function cold start latency | Consumption plan acceptable for delete operations (not latency-critical) |
