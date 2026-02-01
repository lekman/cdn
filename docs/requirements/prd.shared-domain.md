---
title: Shared Domain Layer
version: 1.0.0
author: Claude Code
date: 2026-01-31
status: done
epic: EPIC.md
priority: P0
ticket-id: shared-domain
---

# Shared Domain Layer

## Problem Statement

The Edge Cache CDN API requires a shared domain layer that defines the core types, interfaces, and constants used across all functions (Delete, Metadata Extraction) and APIM policies. Without a shared layer, each component would independently define types, leading to inconsistencies, duplication, and tight coupling to specific Azure SDK implementations.

## User Personas

### Function Developer

Builds Azure Function handlers (Delete, Metadata Extraction) that need typed interfaces for Cosmos DB, Blob Storage, and Cloudflare. Expects dependency injection with mock implementations for TDD.

### Policy Author

Writes APIM policy XML that references domain constants (content types, size limits, hash format, TTL). Needs a single source of truth for these values.

## Vision Statement

A pure TypeScript domain layer with zero external dependencies that defines the canonical types, interfaces, and constants for the CDN API. Every downstream PRD imports from this layer. Mock implementations enable TDD without infrastructure.

## Market Opportunity

Foundation layer that all other PRDs depend on. Without shared types and interfaces, each component would independently define types leading to inconsistency and tight coupling to Azure SDK implementations. This is a blocking prerequisite for PRDs 3-6.

## Architecture & Design

### Clean Architecture Layers

```
┌─────────────────────────────────────────────┐
│  Frameworks & Drivers (Azure SDK, HTTP)     │  ← PRDs 3–6 (*.system.ts)
├─────────────────────────────────────────────┤
│  Interface Adapters (ICosmosClient, etc.)   │  ← This PRD (*-interface.ts)
├─────────────────────────────────────────────┤
│  Enterprise Business Rules (Types, Consts)  │  ← This PRD (types.ts, constants.ts)
└─────────────────────────────────────────────┘
```

### Technology Choices

| Choice | Rationale |
|--------|-----------|
| Pure TypeScript | Zero external dependencies, maximum portability |
| Runtime type guards | Validate data at system boundaries (Cosmos responses, API inputs) |
| Per-file interfaces | `{name}-interface.ts` convention for clear dependency boundaries |
| Barrel export | Single `index.ts` entry point for downstream imports |

### File Organization

```
src/shared/
  types.ts               # Domain types + runtime type guards
  constants.ts           # Constants + validation functions
  cosmos-interface.ts    # ICosmosClient contract
  blob-interface.ts      # IBlobClient contract
  cloudflare-interface.ts # ICloudflareClient + CloudflarePurgeError
  index.ts               # Barrel export
```

## Domain Model

### ImageDocument (Cosmos DB)

```typescript
interface ImageDocument {
  id: string;            // SHA-256 base64url hash (43 chars)
  url: string;           // CDN_BASE_URL + "/" + id
  status: ImageStatus;   // "processing" | "ready" | "failed"
  size: number;          // Request body byte length
  contentType: string;   // Original Content-Type header
  width: number | null;  // null until metadata extraction
  height: number | null; // null until metadata extraction
  exif: ExifData | null; // null until metadata extraction
  createdAt: string;     // UTC ISO 8601
  ttl: number;           // 604800 (7 days)
}
```

### ExifData

```typescript
interface ExifData {
  created: string | null;                          // DateTimeOriginal
  location: { lat: number; lon: number } | null;   // GPS coordinates
  camera: string | null;                           // Make/Model
}
```

### ImageStatus

```typescript
type ImageStatus = "processing" | "ready" | "failed";
```

Lifecycle: `processing` → `ready` (metadata extracted) or `failed` (extraction error, no retry).

### Supporting Types

| Type | Fields | Purpose |
|------|--------|---------|
| `DeleteResult` | `status: number`, `error?: string` | Delete function response |
| `MetadataResult` | `width: number`, `height: number`, `exif: ExifData \| null` | Extraction output |
| `CreateImageInput` | `hash: string`, `size: number`, `contentType: string` | Cosmos document creation input |

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `SUPPORTED_CONTENT_TYPES` | `["image/png", "image/jpeg", "image/gif", "image/webp"]` | Request validation |
| `MAX_IMAGE_SIZE` | `26214400` (25MB) | Size limit |
| `HASH_LENGTH` | `43` | Base64url SHA-256 length |
| `DEFAULT_TTL` | `604800` (7 days) | Cosmos document TTL |
| `CDN_BASE_URL` | `https://img.lekman.com` | CDN URL construction |

## Interface Boundaries

### ICosmosClient (`cosmos-interface.ts`)

```typescript
interface ICosmosClient {
  read(id: string): Promise<ImageDocument | null>;
  create(doc: ImageDocument): Promise<ImageDocument>;
  update(id: string, updates: Partial<ImageDocument>): Promise<ImageDocument>;
  delete(id: string): Promise<void>;
}
```

Used by: PRD 5 (Metadata Extraction), PRD 6 (Delete Pipeline)

### IBlobClient (`blob-interface.ts`)

```typescript
interface IBlobClient {
  write(hash: string, data: Buffer, contentType: string): Promise<void>;
  read(hash: string): Promise<Buffer>;
  delete(hash: string): Promise<void>;
  exists(hash: string): Promise<boolean>;
}
```

Used by: PRD 5 (Metadata Extraction), PRD 6 (Delete Pipeline)

### ICloudflareClient (`cloudflare-interface.ts`)

```typescript
interface ICloudflareClient {
  purge(url: string): Promise<void>;
}

class CloudflarePurgeError extends Error {
  readonly statusCode: number;
}
```

Used by: PRD 6 (Delete Pipeline)

## Security Considerations

### No Secrets in Source

- Interfaces define contracts only — no connection strings, API keys, or tokens
- `*.system.ts` implementations (PRDs 5-6) use managed identity, not hardcoded credentials
- Cloudflare API token retrieved from Key Vault at runtime (deferred to `cloudflare.system.ts`)

### Type Safety at Boundaries

- Runtime type guards (`isImageDocument`, `isExifData`, `isValidStatus`) validate data from external sources
- `isSupportedContentType` and `isValidHash` validate user input
- All guards return `false` for `null`, `undefined`, and wrong types — no exceptions thrown

## Core Features (Must Have)

### Domain Types

Core TypeScript type definitions representing the Cosmos DB document schema and API contracts. Includes runtime type guards for all complex types.

### Service Interfaces

Interface contracts for all external I/O boundaries (Cosmos DB, Blob Storage, Cloudflare API) following the `{name}-interface.ts` convention.

### Domain Constants

Validated constants for content types, size limits, hash specifications, and TTL values. Includes validation functions (`isSupportedContentType`, `isValidHash`).

### Mock Implementations

In-memory test doubles implementing all service interfaces for use in unit tests across PRDs 5-6. Includes failure simulation and state inspection methods.

## Dependencies

- **Depends on:** Nothing (foundation layer)
- **Depended on by:** PRD 3 (Upload Pipeline), PRD 4 (Metadata Retrieval), PRD 5 (Metadata Extraction), PRD 6 (Delete Pipeline)

## Work Breakdown Structure

### WBS 1: Domain Types (`src/shared/types.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 1.1 | Define `ImageStatus` union type | Entity | `"processing" \| "ready" \| "failed"` literal union |
| 1.2 | Define `ExifData` interface | Entity | Fields: `created` (string, nullable), `location` (nullable object with `lat`/`lon` numbers), `camera` (string, nullable) |
| 1.3 | Define `ImageDocument` interface | Entity | Fields: `id`, `url`, `status` (ImageStatus), `size`, `contentType`, `width` (nullable), `height` (nullable), `exif` (nullable ExifData), `createdAt`, `ttl` — matches EPIC §4.1 exactly |
| 1.4 | Define `DeleteResult` interface | Entity | Fields: `status` (number), `error` (optional string) |
| 1.5 | Define `MetadataResult` interface | Entity | Fields: `width`, `height`, `exif` (nullable ExifData) |
| 1.6 | Define `CreateImageInput` interface | Entity | Fields: `hash`, `size`, `contentType` — input to Cosmos create |

**TDD Plan for WBS 1:**

| Step | Test (RED) | Implementation (GREEN) |
|------|-----------|----------------------|
| 1 | Test that `ImageStatus` only allows valid values via type guard | Write `isValidStatus()` type guard function |
| 2 | Test that `ImageDocument` requires all mandatory fields | Write type guard `isImageDocument()` |
| 3 | Test that `ExifData` handles all nullable fields | Write type guard `isExifData()` |

**Files:**
- `src/shared/types.ts` — Type definitions and type guards
- `tests/unit/shared/types.test.ts` — Type guard tests

### WBS 2: Domain Constants (`src/shared/constants.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 2.1 | Define `SUPPORTED_CONTENT_TYPES` | Entity | `readonly ["image/png", "image/jpeg", "image/gif", "image/webp"]` |
| 2.2 | Define `MAX_IMAGE_SIZE` | Entity | `25 * 1024 * 1024` (25MB in bytes) |
| 2.3 | Define `HASH_LENGTH` | Entity | `43` (base64url SHA-256 without padding) |
| 2.4 | Define `DEFAULT_TTL` | Entity | `604800` (7 days in seconds) |
| 2.5 | Define `CDN_BASE_URL` | Entity | `"https://img.lekman.com"` |
| 2.6 | Define `isSupportedContentType()` guard | Entity | Returns `true` only for values in `SUPPORTED_CONTENT_TYPES` |
| 2.7 | Define `isValidHash()` validator | Entity | Returns `true` for 43-char base64url strings (regex: `^[A-Za-z0-9_-]{43}$`) |

**TDD Plan for WBS 2:**

| Step | Test (RED) | Implementation (GREEN) |
|------|-----------|----------------------|
| 1 | Test `isSupportedContentType()` returns true for each valid type | Implement against `SUPPORTED_CONTENT_TYPES` array |
| 2 | Test `isSupportedContentType()` returns false for `"text/plain"`, `"image/svg+xml"`, empty string | Already passes from step 1 |
| 3 | Test `isValidHash()` accepts valid 43-char base64url strings | Implement regex validator |
| 4 | Test `isValidHash()` rejects too short, too long, invalid characters, padding (`=`) | Validate edge cases |
| 5 | Test all constants have expected values | Assert each constant value |

**Files:**
- `src/shared/constants.ts` — Constants and validation functions
- `tests/unit/shared/constants.test.ts` — Validation tests

### WBS 3: Cosmos DB Interface (`src/shared/cosmos-interface.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 3.1 | Define `ICosmosClient` interface | Interface Adapter | Methods: `read(id): Promise<ImageDocument \| null>`, `create(doc): Promise<ImageDocument>`, `update(id, updates): Promise<ImageDocument>`, `delete(id): Promise<void>` |

**Files:**
- `src/shared/cosmos-interface.ts` — Interface definition only (no tests needed for pure interfaces)

### WBS 4: Blob Storage Interface (`src/shared/blob-interface.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 4.1 | Define `IBlobClient` interface | Interface Adapter | Methods: `write(hash, data, contentType): Promise<void>`, `read(hash): Promise<Buffer>`, `delete(hash): Promise<void>`, `exists(hash): Promise<boolean>` |

**Files:**
- `src/shared/blob-interface.ts` — Interface definition only

### WBS 5: Cloudflare Interface (`src/shared/cloudflare-interface.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 5.1 | Define `ICloudflareClient` interface | Interface Adapter | Methods: `purge(url): Promise<void>` |
| 5.2 | Define `CloudflarePurgeError` error class | Interface Adapter | Extends `Error`, adds `statusCode` property |

**Files:**
- `src/shared/cloudflare-interface.ts` — Interface and error type definitions

### WBS 6: Mock Implementations (`tests/mocks/`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 6.1 | Implement `CosmosClientMock` | Test Double | Implements `ICosmosClient`, in-memory `Map<string, ImageDocument>`, supports `setDocument()`, `setShouldFail()`, `clear()` methods |
| 6.2 | Implement `BlobClientMock` | Test Double | Implements `IBlobClient`, in-memory `Map<string, { data: Buffer, contentType: string }>`, supports `setBlob()`, `setShouldFail()`, `clear()` methods |
| 6.3 | Implement `CloudflareClientMock` | Test Double | Implements `ICloudflareClient`, tracks purge calls, supports `setPurgeShouldFail()`, `getPurgeCalls()`, `clear()` methods |

**TDD Plan for WBS 6:**

| Step | Test (RED) | Implementation (GREEN) |
|------|-----------|----------------------|
| 1 | Test `CosmosClientMock.read()` returns null for missing doc | Implement with empty Map |
| 2 | Test `CosmosClientMock.create()` stores and returns document | Implement Map.set() |
| 3 | Test `CosmosClientMock.read()` returns stored document | Already passes |
| 4 | Test `CosmosClientMock.update()` merges partial updates | Implement spread merge |
| 5 | Test `CosmosClientMock.delete()` removes document | Implement Map.delete() |
| 6 | Test `CosmosClientMock` failure simulation | Implement setShouldFail() |
| 7 | Repeat pattern for `BlobClientMock` | Same in-memory Map pattern |
| 8 | Repeat pattern for `CloudflareClientMock` | Track purge calls array |

**Files:**
- `tests/mocks/cosmos-mock.ts`
- `tests/mocks/blob-mock.ts`
- `tests/mocks/cloudflare-mock.ts`
- `tests/unit/mocks/cosmos-mock.test.ts`
- `tests/unit/mocks/blob-mock.test.ts`
- `tests/unit/mocks/cloudflare-mock.test.ts`

### WBS 7: Module Index (`src/shared/index.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 7.1 | Create barrel export for all shared types | Module API | Re-exports all types, interfaces, constants, and validation functions |

**Files:**
- `src/shared/index.ts` — Barrel export only

## Test Strategy

This PRD follows the project TDD workflow: **RED → GREEN → REFACTOR**.

### Type Guard Tests (RED → GREEN)

1. Test `isValidStatus()` returns true for "processing", "ready", "failed" and false for all other values
2. Test `isImageDocument()` validates all 10 fields, nullable fields, and rejects partial/invalid objects
3. Test `isExifData()` validates nullable fields and nested location object

### Constant Validation Tests (RED → GREEN)

1. Test each constant has the expected value
2. Test `isSupportedContentType()` against all 4 valid types and rejects others
3. Test `isValidHash()` against valid/invalid hash strings (length, characters, padding)

### Mock Behavior Tests (RED → GREEN)

1. Test CRUD operations on each mock
2. Test failure simulation (`setShouldFail()`)
3. Test state reset (`clear()`)

### Refactor

After tests pass, verify:
- Type guards cover all branches (null, undefined, wrong types)
- Constants use `as const` for type narrowing
- Mocks implement interfaces without extra methods leaking into production API

## Acceptance Criteria

1. Given the EPIC §4.1 schema, when all domain types are defined, then every field from the EPIC is represented in TypeScript types with correct types and nullability
2. Given an `ImageDocument` from Cosmos DB, when `isImageDocument()` is called, then it returns `true` only if all required fields are present with correct types
3. Given an invalid object, when `isImageDocument()` is called, then it returns `false` for null, undefined, missing fields, and wrong types
4. Given a content type string, when `isSupportedContentType()` is called, then it returns `true` only for the 4 supported MIME types (case-sensitive)
5. Given a hash string, when `isValidHash()` is called, then it returns `true` only for 43-character base64url strings matching `^[A-Za-z0-9_-]{43}$`
6. Given a `CosmosClientMock`, when CRUD operations are performed, then it stores, retrieves, updates, and deletes documents in-memory
7. Given any mock with `setShouldFail(true)`, when a method is called, then it throws an error
8. Given all shared files, when coverage is measured, then line coverage is >= 80% and function coverage is >= 60%
9. Given the `src/shared/index.ts` barrel, when imported, then all types, interfaces, constants, and validation functions are accessible

## File Summary

| File | Layer | Coverage |
|------|-------|----------|
| `src/shared/types.ts` | Entity | Included |
| `src/shared/constants.ts` | Entity | Included |
| `src/shared/cosmos-interface.ts` | Interface | Excluded (types only) |
| `src/shared/blob-interface.ts` | Interface | Excluded (types only) |
| `src/shared/cloudflare-interface.ts` | Interface | Excluded (types only) |
| `src/shared/index.ts` | Module API | Excluded (re-exports) |
| `tests/mocks/cosmos-mock.ts` | Test Double | Excluded (test infra) |
| `tests/mocks/blob-mock.ts` | Test Double | Excluded (test infra) |
| `tests/mocks/cloudflare-mock.ts` | Test Double | Excluded (test infra) |

## Milestones

| Phase | Deliverables | Dependencies |
|-------|-------------|-------------|
| Phase 1 | Domain types + constants + tests | None |
| Phase 2 | Service interfaces (Cosmos, Blob, Cloudflare) | Phase 1 (types referenced by interfaces) |
| Phase 3 | Mock implementations + tests | Phase 2 (implements interfaces) |
| Phase 4 | Module index + integration verification | Phases 1–3 |

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Type definitions drift from Cosmos DB schema | Type guards validate runtime shape; tests enforce EPIC §4.1 compliance |
| Interface too broad or too narrow | Follow Interface Segregation Principle — minimal surface area per interface |
| Mocks don't match real behavior | Mocks implement same interface; integration tests (out of scope) verify real implementations |
