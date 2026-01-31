# PRD: Shared Domain Layer

**Version:** 1.0
**Author:** Claude Code
**Date:** 31 January 2026
**Status:** Draft
**Epic Reference:** EPIC.md — Cross-cutting foundation
**Priority:** P0 (Prerequisite for PRDs 3–6)

---

## Background

### Problem Statement

The Edge Cache CDN API requires a shared domain layer that defines the core types, interfaces, and constants used across all functions (Delete, Metadata Extraction) and APIM policies. Without a well-defined shared layer, each component would independently define types, leading to inconsistencies, duplication, and tight coupling to specific Azure SDK implementations.

### System Context

This PRD establishes the innermost layer of the clean architecture — the **Enterprise Business Rules** (entities) and **Interface Adapters** (contracts). All other PRDs depend on this layer.

```
┌─────────────────────────────────────────────┐
│  Frameworks & Drivers (Azure SDK, HTTP)     │  ← PRDs 3–6
├─────────────────────────────────────────────┤
│  Interface Adapters (ICosmosClient, etc.)   │  ← This PRD
├─────────────────────────────────────────────┤
│  Enterprise Business Rules (Types, Consts)  │  ← This PRD
└─────────────────────────────────────────────┘
```

### Dependencies

- **Depends on:** Nothing (foundation layer)
- **Depended on by:** PRD 3 (Upload Pipeline), PRD 5 (Delete Pipeline), PRD 6 (Metadata Extraction)

---

## Objectives

### SMART Goals

- **Specific:** Define all domain types, service interfaces, constants, and mock implementations for the CDN API
- **Measurable:** 100% of shared types have corresponding unit tests validating type guards and constants
- **Achievable:** Pure TypeScript types and interfaces with no external dependencies
- **Relevant:** Foundation for all Azure Function handlers and APIM policy data contracts
- **Time-bound:** Must be completed before any function handler work begins

### Key Performance Indicators

| KPI | Target |
|-----|--------|
| Type coverage | 100% of domain concepts from EPIC §4 |
| Test coverage (line) | ≥ 80% for business logic files |
| Test coverage (function) | ≥ 60% |
| External dependencies | Zero (pure TypeScript) |

---

## Features

### Feature 1: Domain Types

Core TypeScript type definitions representing the Cosmos DB document schema and API contracts.

### Feature 2: Service Interfaces

Interface contracts for all external I/O boundaries (Cosmos DB, Blob Storage, Cloudflare API) following the `*.system.ts` convention from the clean architecture guide.

### Feature 3: Domain Constants

Validated constants for content types, size limits, hash specifications, and TTL values.

### Feature 4: Mock Implementations

In-memory test doubles implementing all service interfaces for use in unit tests across PRDs 5–6.

---

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

---

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

---

### WBS 3: Cosmos DB Interface (`src/shared/cosmos-interface.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 3.1 | Define `ICosmosClient` interface | Interface Adapter | Methods: `read(id: string): Promise<ImageDocument \| null>`, `create(doc: ImageDocument): Promise<ImageDocument>`, `update(id: string, updates: Partial<ImageDocument>): Promise<ImageDocument>`, `delete(id: string): Promise<void>` |

**Files:**
- `src/shared/cosmos-interface.ts` — Interface definition only (no tests needed for pure interfaces)

---

### WBS 4: Blob Storage Interface (`src/shared/blob-interface.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 4.1 | Define `IBlobClient` interface | Interface Adapter | Methods: `write(hash: string, data: Buffer, contentType: string): Promise<void>`, `read(hash: string): Promise<Buffer>`, `delete(hash: string): Promise<void>`, `exists(hash: string): Promise<boolean>` |

**Files:**
- `src/shared/blob-interface.ts` — Interface definition only

---

### WBS 5: Cloudflare Interface (`src/shared/cloudflare-interface.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 5.1 | Define `ICloudflareClient` interface | Interface Adapter | Methods: `purge(url: string): Promise<void>` |
| 5.2 | Define `CloudflarePurgeError` error class | Interface Adapter | Extends `Error`, adds `statusCode` property |

**Files:**
- `src/shared/cloudflare-interface.ts` — Interface and error type definitions

---

### WBS 6: Mock Implementations (`tests/mocks/`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 6.1 | Implement `CosmosClientMock` | Test Double | Implements `ICosmosClient`, in-memory `Map<string, ImageDocument>`, supports `setDocument()`, `setShouldFail()`, `clear()` methods for test configuration |
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

---

### WBS 7: Module Index (`src/shared/index.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 7.1 | Create barrel export for all shared types | Module API | Re-exports all types, interfaces, constants, and validation functions |

**Files:**
- `src/shared/index.ts` — Barrel export only (excluded from coverage)

---

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

---

## Milestones

| Phase | Deliverables | Dependencies |
|-------|-------------|-------------|
| Phase 1 | Domain types + constants + tests | None |
| Phase 2 | Service interfaces (Cosmos, Blob, Cloudflare) | Phase 1 (types referenced by interfaces) |
| Phase 3 | Mock implementations + tests | Phase 2 (implements interfaces) |
| Phase 4 | Module index + integration verification | Phases 1–3 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Type definitions drift from Cosmos DB schema | Type guards validate runtime shape; tests enforce EPIC §4.1 compliance |
| Interface too broad or too narrow | Follow Interface Segregation Principle — minimal surface area per interface |
| Mocks don't match real behavior | Mocks implement same interface; integration tests (out of scope) verify real implementations |
