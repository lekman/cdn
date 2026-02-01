# Implementation Roadmap

Status overview and dependency-ordered plan for the Edge Cache CDN API.

## PRD Status

| # | PRD | Scope | Status |
|---|-----|-------|--------|
| 1 | [Shared Domain](prd.shared-domain.md) | Types, interfaces, constants, mocks | Done |
| 2 | [Infrastructure](prd.infrastructure.md) | Bicep IaC, APIM config, Cloudflare runbook | Done |
| 3 | [Upload Pipeline](prd.upload-pipeline.md) | APIM policy for POST /images | Done |
| 4 | [Metadata Retrieval](prd.metadata-retrieval.md) | APIM policy for GET /images/{hash} | Done |
| 5 | [Metadata Extraction](prd.metadata-extraction.md) | Service Bus-triggered Function | Not started |
| 6 | [Delete Pipeline](prd.delete-pipeline.md) | Function handler + APIM policy for DELETE /images/{hash} | Not started |

## Dependency Graph

```
PRD 1: Shared Domain
  │
  ├──→ PRD 6: Delete Pipeline (handler + system clients)
  │       │
  │       └──→ uses ICosmosClient, IBlobClient, ICloudflareClient
  │
  ├──→ PRD 5: Metadata Extraction (handler + extraction utils)
  │       │
  │       ├──→ uses ICosmosClient, IBlobClient
  │       └──→ consumes queue messages from PRD 3
  │
  ├──→ PRD 3: Upload Pipeline (APIM policy XML)
  │       │
  │       └──→ produces queue messages for PRD 5
  │
  └──→ PRD 4: Metadata Retrieval (APIM policy XML)

PRD 2: Infrastructure (parallel track — Bicep)
  │
  └──→ required for deployment of PRDs 3, 4, 5, 6
       (not required for local development/testing)
```

## Implementation Phases

### Phase 0: Foundation — Done

**PRD 1: Shared Domain Layer**

- Domain types with runtime type guards (`ImageDocument`, `ExifData`, etc.)
- Domain constants and validators (`HASH_LENGTH`, `isSupportedContentType()`, etc.)
- Service interfaces (`ICosmosClient`, `IBlobClient`, `ICloudflareClient`)
- Mock implementations for TDD (`CosmosClientMock`, `BlobClientMock`, `CloudflareClientMock`)
- Barrel export (`src/shared/index.ts`)
- 83 tests, 100% coverage

### Phase 1: Function Handlers — Next

Function business logic can be developed and fully tested using mocks from Phase 0. No infrastructure deployment needed.

#### PRD 6: Delete Pipeline

**Why first:** Creates the shared `*.system.ts` implementations (`cosmos.system.ts`, `blob.system.ts`, `cloudflare.system.ts`) that PRD 5 also needs.

**Deliverables:**
- `src/functions/delete/handler.ts` — business logic (delete blob → cosmos → purge CDN)
- `src/shared/cosmos.system.ts` — Cosmos DB SDK wrapper
- `src/shared/blob.system.ts` — Blob Storage SDK wrapper
- `src/shared/cloudflare.system.ts` — Cloudflare API client (Key Vault token retrieval)
- `src/functions/delete/index.system.ts` — HTTP trigger entry point
- `tests/unit/functions/delete/handler.test.ts`

**Depends on:** PRD 1 (types, interfaces, mocks)

#### PRD 5: Metadata Extraction

**Why second:** Reuses system clients from PRD 6. Queue message format is known from EPIC spec.

**Deliverables:**
- `src/functions/metadata-extraction/handler.ts` — orchestration (read blob → extract → update Cosmos)
- `src/functions/metadata-extraction/extraction.ts` — pure functions (dimensions, EXIF, GPS conversion)
- `src/functions/metadata-extraction/index.system.ts` — Service Bus trigger entry point
- `tests/unit/functions/metadata-extraction/handler.test.ts`
- `tests/unit/functions/metadata-extraction/extraction.test.ts`

**Depends on:** PRD 1 (types, interfaces, mocks), PRD 6 (system clients)

### Phase 2: APIM Policies

APIM policies are XML files that run inside Azure API Management. They implement request validation, hashing, storage operations, and response shaping without application code.

#### PRD 3: Upload Pipeline (POST /images)

**Deliverables:**
- `policies/post-images.xml` — validate content type/size, SHA-256 hash, dedup check, store blob, create Cosmos doc, queue message
- Integration test plan (requires deployed infrastructure)

**Depends on:** PRD 1 (constants for validation), PRD 2 (deployed APIM, Blob, Cosmos, Service Bus)

#### PRD 4: Metadata Retrieval (GET /images/{hash})

**Deliverables:**
- `policies/get-image.xml` — validate hash format, Cosmos point-read, 200/404 response

**Depends on:** PRD 2 (deployed APIM, Cosmos)

#### PRD 6 (continued): Delete APIM Policy

**Deliverables:**
- `policies/delete-image.xml` — route to Delete Function backend

**Depends on:** PRD 2 (deployed APIM, Function App)

### Phase 3: Infrastructure

Bicep IaC can be developed at any point but must be deployed before integration testing.

#### PRD 2: Infrastructure Provisioning

**Deliverables:**
- `infra/main.bicep` — main composition
- `infra/modules/storage.bicep` — Blob Storage (Hot, LRS, 7-day lifecycle)
- `infra/modules/cosmosdb.bicep` — Cosmos DB (Serverless, TTL, /id partition)
- `infra/modules/servicebus.bicep` — Service Bus + queue (1-hour TTL, no retry)
- `infra/modules/functions.bicep` — Function App (Consumption, Managed Identity, RBAC)
- `infra/modules/keyvault.bicep` — Key Vault (Cloudflare token)
- `infra/modules/apim.bicep` — API Management (3 operations, mTLS, rate limiting)
- `infra/params/dev.bicepparam` + `infra/params/prod.bicepparam`
- `.github/workflows/deploy-infra.yml`
- `docs/runbooks/cloudflare-setup.md`

**Depends on:** Nothing (parallel track)

## Recommended Sequence

```
Phase 0                Phase 1                Phase 2          Phase 3
────────              ─────────              ────────          ────────
PRD 1    ──→ PRD 6 (Delete handler) ──→ PRD 3 (Upload) ──→ Integration
             PRD 5 (Metadata Extract)   PRD 4 (GET)         Testing
                                        PRD 6 (APIM)

             PRD 2 (Infrastructure) ─────────────────────→ Deploy
             ↑ parallel track, start anytime
```

**Next task: PRD 6 (Delete Pipeline)** — it creates the shared system clients and the first function handler, giving the largest foundation for subsequent work.

## Cross-Cutting Contracts

All PRDs share these contracts defined in Phase 0:

| Contract | Source | Used By |
|----------|--------|---------|
| `ImageDocument` schema | `src/shared/types.ts` | PRDs 3, 4, 5, 6 |
| `ImageStatus` lifecycle (`processing` → `ready`/`failed`) | `src/shared/types.ts` | PRDs 3, 5 |
| Hash format (SHA-256 → base64url, 43 chars) | `src/shared/constants.ts` | PRDs 3, 4, 6 |
| `ICosmosClient` interface | `src/shared/cosmos-interface.ts` | PRDs 5, 6 |
| `IBlobClient` interface | `src/shared/blob-interface.ts` | PRDs 5, 6 |
| `ICloudflareClient` interface | `src/shared/cloudflare-interface.ts` | PRD 6 |
| Content type validation | `src/shared/constants.ts` | PRD 3 |
| Size limit (25MB) | `src/shared/constants.ts` | PRD 3 |
| TTL (7 days / 604800s) | `src/shared/constants.ts` | PRDs 3, 5 |
| CDN base URL | `src/shared/constants.ts` | PRDs 3, 6 |

## Queue Message Contract

Upload (PRD 3) produces → Metadata Extraction (PRD 5) consumes:

```json
{
  "hash": "<43-char base64url SHA-256>"
}
```

Service Bus queue: `image-metadata-extraction`, 1-hour message TTL, no automatic retry.
