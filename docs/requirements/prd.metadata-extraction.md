# PRD: Metadata Extraction Function

**Version:** 1.0
**Author:** Claude Code
**Date:** 31 January 2026
**Status:** Draft
**Epic Reference:** EPIC.md — Epic 5 (Story 5.1)
**Priority:** P1

---

## Background

### Problem Statement

When an image is uploaded via POST /images, metadata extraction (dimensions, EXIF data) is deferred to an asynchronous process. A Service Bus-triggered Azure Function must read the stored blob, extract image metadata, and update the Cosmos DB document with the results. This decouples upload latency from processing time.

### System Context

The Metadata Extraction Function is triggered by a Service Bus queue message (produced by the Upload Pipeline in PRD 3). It reads the blob, extracts metadata, and updates the Cosmos document status from `processing` to either `ready` or `failed`.

```
Service Bus (image-metadata-extraction queue)
  └─ Trigger: Metadata Extraction Function
       ├─ Read blob from storage by hash
       ├─ Extract width, height from image headers
       ├─ Extract EXIF data (if present)
       │   ├─ DateTimeOriginal → exif.created
       │   ├─ GPS coordinates → exif.location
       │   └─ Make/Model → exif.camera
       ├─ Success → Update Cosmos: status=ready, +metadata
       └─ Failure → Update Cosmos: status=failed, log error
```

### Dependencies

- **Depends on:** PRD 1 (Shared Domain — types, interfaces, mocks), PRD 2 (Infrastructure — Function App, Service Bus, Blob, Cosmos), PRD 3 (Upload Pipeline — produces queue messages)
- **Depended on by:** Nothing (terminal async process)

---

## Objectives

### SMART Goals

- **Specific:** Implement the metadata extraction handler and Service Bus trigger entry point
- **Measurable:** Processing completes within 30 seconds (EPIC §7); ≥ 80% line coverage on handler
- **Achievable:** Image metadata extraction via standard libraries (sharp or image-size for dimensions, exif-reader for EXIF)
- **Relevant:** Completes the async metadata pipeline started by upload
- **Time-bound:** Deployable after infrastructure and shared domain layer

### Key Performance Indicators

| KPI | Target |
|-----|--------|
| Handler test coverage (line) | ≥ 80% |
| Handler test coverage (function) | ≥ 60% |
| Processing time | < 30 seconds from message receipt |
| Success: Cosmos status | `ready` with `width`, `height`, optional `exif` |
| Failure: Cosmos status | `failed`, error logged, no retry |

---

## Features

### Feature 1: Service Bus Message Processing

Parse the queue message to extract the image hash and trigger processing.

### Feature 2: Image Metadata Extraction

Read the blob and extract dimensions (width/height) from image headers.

### Feature 3: EXIF Data Extraction

Extract EXIF metadata (DateTimeOriginal, GPS, camera make/model) when present.

### Feature 4: Cosmos DB Status Update

Update the document with extracted metadata and transition status to `ready` or `failed`.

---

## Work Breakdown Structure

### WBS 1: Handler Interface Design

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 1.1 | Define `ExtractionDeps` interface | Interface Adapter | `{ cosmos: ICosmosClient; blob: IBlobClient }` |
| 1.2 | Define `ExtractionMessage` type | Entity | `{ hash: string }` — matches Service Bus message body |
| 1.3 | Define handler function signature | Application Business Rule | `extractMetadata(message: ExtractionMessage, deps: ExtractionDeps): Promise<void>` |

**Files:**
- `src/functions/metadata-extraction/handler.ts` — Function signature and types

---

### WBS 2: Image Dimension Extraction — TDD Implementation

| Task | Test Case (RED) | Implementation (GREEN) | Acceptance Criteria |
|------|----------------|----------------------|-------------------|
| 2.1 | Test: reads blob by hash from deps.blob | Configure BlobClientMock with test image buffer; verify `blob.read(hash)` called | AC2: Function reads blob from storage |
| 2.2 | Test: extracts width and height from PNG image | Provide valid PNG buffer in mock; assert `width` and `height` returned | AC3: Extracts width, height from image headers |
| 2.3 | Test: extracts width and height from JPEG image | Provide valid JPEG buffer in mock; assert dimensions | AC3: Works for JPEG |
| 2.4 | Test: extracts width and height from GIF image | Provide valid GIF buffer in mock; assert dimensions | AC3: Works for GIF |
| 2.5 | Test: extracts width and height from WebP image | Provide valid WebP buffer in mock; assert dimensions | AC3: Works for WebP |

**Architecture Notes:**
- Image dimension extraction should use a pure function: `extractDimensions(buffer: Buffer): { width: number; height: number }`
- The dimension extraction library (e.g. `image-size`) is a pure dependency — no system boundary needed
- Test with minimal valid image buffers (smallest valid PNG, JPEG, etc.)

---

### WBS 3: EXIF Data Extraction — TDD Implementation

| Task | Test Case (RED) | Implementation (GREEN) | Acceptance Criteria |
|------|----------------|----------------------|-------------------|
| 3.1 | Test: extracts DateTimeOriginal as `exif.created` | Provide JPEG with EXIF DateTimeOriginal; assert `exif.created` is ISO 8601 string | AC4: Extracts DateTimeOriginal |
| 3.2 | Test: extracts GPS coordinates as `exif.location` | Provide JPEG with GPS EXIF tags; assert `exif.location.lat` and `exif.location.lon` | AC4: Extracts GPS coordinates |
| 3.3 | Test: extracts Make/Model as `exif.camera` | Provide JPEG with Make/Model EXIF tags; assert `exif.camera` is formatted string | AC4: Extracts Make/Model |
| 3.4 | Test: returns null exif when no EXIF data present | Provide JPEG without EXIF; assert `exif` is null | AC4: EXIF data if present |
| 3.5 | Test: returns null exif for non-JPEG formats | Provide PNG buffer; assert `exif` is null (PNG rarely has EXIF) | AC4: EXIF data if present |
| 3.6 | Test: handles partial EXIF (some fields missing) | Provide JPEG with only DateTimeOriginal; assert `location` and `camera` are null | Graceful handling of partial data |

**Architecture Notes:**
- EXIF extraction should use a pure function: `extractExif(buffer: Buffer): ExifData | null`
- The EXIF library (e.g. `exif-reader`) is a pure dependency
- GPS coordinate conversion from DMS to decimal degrees is business logic (testable)

---

### WBS 4: Cosmos DB Update — TDD Implementation

| Task | Test Case (RED) | Implementation (GREEN) | Acceptance Criteria |
|------|----------------|----------------------|-------------------|
| 4.1 | Test: on success, updates Cosmos with status=ready + metadata | Assert `cosmos.update(hash, { status: "ready", width, height, exif })` called | AC5: Updates Cosmos with metadata, status: ready |
| 4.2 | Test: on extraction failure, updates Cosmos with status=failed | Configure dimension extraction to throw; assert `cosmos.update(hash, { status: "failed" })` | AC6: Sets status: failed |
| 4.3 | Test: on failure, does not retry | Assert function completes normally (does not throw) after failure | AC6: No retry |
| 4.4 | Test: on blob not found, sets status=failed | Configure BlobClientMock to throw "not found"; assert status: failed | Edge case: blob deleted before extraction |

---

### WBS 5: Handler Integration — TDD Implementation

| Task | Test Case (RED) | Implementation (GREEN) | Acceptance Criteria |
|------|----------------|----------------------|-------------------|
| 5.1 | Test: full success path (read blob → extract → update) | End-to-end with mocks: blob returns image, extraction succeeds, Cosmos updated to ready | AC1–AC5 combined |
| 5.2 | Test: processing completes (no hanging promises) | Assert function resolves within timeout | AC7: Processing completes within 30 seconds |
| 5.3 | Test: invalid message format handled gracefully | Pass message without `hash` field; assert error logged, no crash | Defensive input validation |

**Files:**
- `src/functions/metadata-extraction/handler.ts` — Business logic implementation
- `tests/unit/functions/metadata-extraction/handler.test.ts` — All test cases from WBS 2–5

---

### WBS 6: Pure Extraction Utilities

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 6.1 | Implement `extractDimensions(buffer: Buffer)` | Business Logic | Returns `{ width: number; height: number }` or throws on invalid image |
| 6.2 | Implement `extractExif(buffer: Buffer)` | Business Logic | Returns `ExifData \| null`; never throws (returns null on failure) |
| 6.3 | Implement `convertGpsToDecimal(dms: number[], ref: string)` | Business Logic | Converts EXIF GPS DMS format to decimal degrees |

**TDD Plan for WBS 6:**

| Step | Test (RED) | Implementation (GREEN) |
|------|-----------|----------------------|
| 1 | Test `convertGpsToDecimal([51, 30, 26.46], "N")` returns ~51.5074 | Implement DMS-to-decimal formula |
| 2 | Test `convertGpsToDecimal([0, 7, 40.08], "W")` returns ~-0.1278 | Handle South/West negative values |
| 3 | Test `extractDimensions()` with minimal valid PNG | Parse PNG IHDR chunk |
| 4 | Test `extractDimensions()` throws for corrupted buffer | Validate image format detection |
| 5 | Test `extractExif()` returns null for no EXIF | Handle missing EXIF gracefully |

**Files:**
- `src/functions/metadata-extraction/extraction.ts` — Pure utility functions
- `tests/unit/functions/metadata-extraction/extraction.test.ts` — Utility function tests

---

### WBS 7: Function Entry Point (`*.system.ts`)

| Task | Description | Architecture Layer | Acceptance Criteria |
|------|-------------|-------------------|-------------------|
| 7.1 | Create Service Bus trigger binding | Framework/Driver | `function.json` with Service Bus trigger, queue: `image-metadata-extraction` |
| 7.2 | Create system entry point | Framework/Driver | Parse Service Bus message, instantiate real deps, call `extractMetadata()` |
| 7.3 | Configure message completion | Framework/Driver | Auto-complete message on success; dead-letter on unrecoverable failure |

**Architecture Notes:**
- This IS a `*.system.ts` file — excluded from coverage
- Contains zero business logic — only wiring and message parsing

**Files:**
- `src/functions/metadata-extraction/index.system.ts` — Azure Function entry point (coverage excluded)

---

## File Summary

| File | Layer | Coverage |
|------|-------|----------|
| `src/functions/metadata-extraction/handler.ts` | Business Logic | Included (≥ 80% line) |
| `src/functions/metadata-extraction/extraction.ts` | Business Logic | Included (≥ 80% line) |
| `src/functions/metadata-extraction/index.system.ts` | Framework/Driver | Excluded (`*.system.ts`) |
| `tests/unit/functions/metadata-extraction/handler.test.ts` | Tests | Excluded (test file) |
| `tests/unit/functions/metadata-extraction/extraction.test.ts` | Tests | Excluded (test file) |

---

## Milestones

| Phase | Deliverables | Dependencies |
|-------|-------------|-------------|
| Phase 1 | Handler interface design (WBS 1) | PRD 1 (interfaces defined) |
| Phase 2 | Pure extraction utilities (WBS 6) | None (pure functions) |
| Phase 3 | Dimension extraction TDD (WBS 2) | Phase 2 |
| Phase 4 | EXIF extraction TDD (WBS 3) | Phase 2 |
| Phase 5 | Cosmos update TDD (WBS 4) | Phase 1 + PRD 1 (mocks available) |
| Phase 6 | Handler integration TDD (WBS 5) | Phases 3–5 |
| Phase 7 | Function entry point wiring (WBS 7) | Phase 6 + PRD 2 (Function App deployed) |

---

## Test Data Requirements

| Test Data | Format | Purpose |
|-----------|--------|---------|
| Minimal valid PNG | 67-byte 1x1 pixel PNG | Dimension extraction test |
| Minimal valid JPEG | 1x1 pixel JPEG | Dimension extraction test |
| Minimal valid GIF | 1x1 pixel GIF89a | Dimension extraction test |
| Minimal valid WebP | 1x1 pixel WebP | Dimension extraction test |
| JPEG with full EXIF | JPEG with DateTimeOriginal, GPS, Make/Model | Full EXIF extraction test |
| JPEG with partial EXIF | JPEG with only DateTimeOriginal | Partial EXIF test |
| JPEG without EXIF | JPEG stripped of metadata | Null EXIF test |
| Corrupted buffer | Random bytes | Error handling test |
| Empty buffer | 0-byte Buffer | Edge case test |

**Note:** Test image buffers should be created programmatically or stored as minimal fixtures in `tests/fixtures/`.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Image library cannot parse all formats | Use well-tested libraries (image-size, exif-reader); fall back to `status: failed` |
| EXIF GPS data in unexpected format | Defensive parsing with null fallback; test with multiple GPS formats |
| Large images cause memory pressure | Streaming read where possible; Function timeout at 30 seconds |
| Blob deleted before extraction runs | Handle blob read failure gracefully → `status: failed` |
| Service Bus message replayed | Idempotent update — re-extracting and overwriting is safe |
