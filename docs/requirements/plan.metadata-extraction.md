# Implementation Plan: Metadata Extraction Function

**PRD Reference:** [prd.metadata-extraction.md](prd.metadata-extraction.md)
**Epic Reference:** EPIC.md — Epic 5 (Story 5.1)
**Status:** Planned

---

## Prerequisites

Before implementation begins, verify:

- [x] Shared domain types exist (`ImageDocument`, `ExifData`, `MetadataResult`, `ImageStatus`) in `src/shared/types.ts`
- [x] Interfaces exist (`ICosmosClient`, `IBlobClient`) in `src/shared/`
- [x] Mock implementations exist (`CosmosClientMock`, `BlobClientMock`) in `tests/mocks/`
- [ ] Runtime dependencies installed (`image-size`, `exif-reader`)

---

## Phase 1: Project Setup & Dependencies

### Task 1.1: Install runtime dependencies

Install `image-size` for dimension extraction and `exif-reader` for EXIF parsing.

```bash
bun add image-size exif-reader
```

**Rationale:** These are well-tested, focused libraries. `image-size` supports PNG, JPEG, GIF, WebP (all four supported content types). `exif-reader` parses EXIF from JPEG buffers.

### Task 1.2: Create directory structure

```
src/functions/metadata-extraction/
tests/unit/functions/metadata-extraction/
tests/fixtures/images/
```

### Task 1.3: Verify toolchain

Run `task quality` to confirm existing tests, lint, and typecheck pass before starting.

---

## Phase 2: Handler Interface Design (WBS 1)

Define types and function signatures. No business logic yet — just the contract.

### Task 2.1: Define `ExtractionMessage` type

**File:** `src/functions/metadata-extraction/handler.ts`

```typescript
export interface ExtractionMessage {
  hash: string;
}
```

Matches the Service Bus message body produced by the upload pipeline (PRD 3).

### Task 2.2: Define `ExtractionDeps` interface

**File:** `src/functions/metadata-extraction/handler.ts`

```typescript
import type { IBlobClient } from "../../shared/blob-interface";
import type { ICosmosClient } from "../../shared/cosmos-interface";

export interface ExtractionDeps {
  cosmos: ICosmosClient;
  blob: IBlobClient;
}
```

Only Cosmos and Blob are needed — no Cloudflare interaction in this function.

### Task 2.3: Define handler function signature

**File:** `src/functions/metadata-extraction/handler.ts`

```typescript
export async function extractMetadata(
  message: ExtractionMessage,
  deps: ExtractionDeps,
): Promise<void> {
  // Implementation in Phase 5
}
```

Returns `void` — side effects (Cosmos update) happen through `deps`. Errors are caught internally; the function never throws (sets `status: failed` instead).

---

## Phase 3: Pure Extraction Utilities — TDD (WBS 6 + WBS 2 + WBS 3)

Implement pure functions first since they have no dependencies on interfaces/mocks.

### Task 3.1: Create test fixtures

**Directory:** `tests/fixtures/images/`

Create minimal valid image buffers programmatically in test setup, or store as fixture files:

| Fixture | Purpose |
|---------|---------|
| 1x1 PNG (67 bytes) | Dimension extraction |
| 1x1 JPEG | Dimension extraction |
| 1x1 GIF89a | Dimension extraction |
| 1x1 WebP | Dimension extraction |
| JPEG with full EXIF | EXIF extraction (DateTimeOriginal, GPS, Make/Model) |
| JPEG with partial EXIF | Partial EXIF (only DateTimeOriginal) |
| JPEG without EXIF | Null EXIF test |
| Random bytes | Error handling |
| Empty buffer | Edge case |

**Implementation note:** Prefer creating minimal buffers programmatically in a test helper to avoid binary fixtures in git. For EXIF tests, small JPEG fixtures with embedded EXIF may be necessary.

### Task 3.2: GPS coordinate conversion — TDD (WBS 6.3)

**Test file:** `tests/unit/functions/metadata-extraction/extraction.test.ts`
**Implementation file:** `src/functions/metadata-extraction/extraction.ts`

TDD cycle:

| Step | RED (test) | GREEN (implementation) |
|------|-----------|----------------------|
| 1 | `convertGpsToDecimal([51, 30, 26.46], "N")` returns `≈51.5074` | Implement DMS-to-decimal: `d + m/60 + s/3600`, negate for S/W |
| 2 | `convertGpsToDecimal([0, 7, 40.08], "W")` returns `≈-0.1278` | Handle South/West negative |
| 3 | `convertGpsToDecimal([0, 0, 0], "N")` returns `0` | Zero case |

**Function signature:**

```typescript
export function convertGpsToDecimal(dms: number[], ref: string): number;
```

### Task 3.3: Dimension extraction — TDD (WBS 6.1 + WBS 2)

**Test file:** `tests/unit/functions/metadata-extraction/extraction.test.ts`
**Implementation file:** `src/functions/metadata-extraction/extraction.ts`

TDD cycle:

| Step | RED (test) | GREEN (implementation) |
|------|-----------|----------------------|
| 1 | `extractDimensions(pngBuffer)` returns `{ width: 1, height: 1 }` | Use `image-size` to parse buffer |
| 2 | `extractDimensions(jpegBuffer)` returns correct dimensions | Same implementation covers JPEG |
| 3 | `extractDimensions(gifBuffer)` returns correct dimensions | Same implementation covers GIF |
| 4 | `extractDimensions(webpBuffer)` returns correct dimensions | Same implementation covers WebP |
| 5 | `extractDimensions(corruptedBuffer)` throws | `image-size` throws on invalid input |
| 6 | `extractDimensions(emptyBuffer)` throws | Handle zero-length buffer |

**Function signature:**

```typescript
export function extractDimensions(buffer: Buffer): { width: number; height: number };
```

### Task 3.4: EXIF extraction — TDD (WBS 6.2 + WBS 3)

**Test file:** `tests/unit/functions/metadata-extraction/extraction.test.ts`
**Implementation file:** `src/functions/metadata-extraction/extraction.ts`

TDD cycle:

| Step | RED (test) | GREEN (implementation) |
|------|-----------|----------------------|
| 1 | `extractExif(jpegWithFullExif)` returns `{ created: "ISO string", location: { lat, lon }, camera: "Make Model" }` | Use `exif-reader`, map fields |
| 2 | `extractExif(jpegWithPartialExif)` returns `{ created: "ISO string", location: null, camera: null }` | Handle missing fields |
| 3 | `extractExif(jpegWithoutExif)` returns `null` | No EXIF app1 marker → null |
| 4 | `extractExif(pngBuffer)` returns `null` | Non-JPEG → null |
| 5 | `extractExif(corruptedBuffer)` returns `null` | Never throws, returns null |
| 6 | `extractExif(jpegWithGps)` correctly converts DMS to decimal | Uses `convertGpsToDecimal` |

**Function signature:**

```typescript
export function extractExif(buffer: Buffer): ExifData | null;
```

**Implementation notes:**
- EXIF data lives in JPEG APP1 marker. Check for `0xFFE1` before attempting parse.
- `exif-reader` returns raw EXIF tags. Map: `DateTimeOriginal` → `created` (convert to ISO 8601), `GPSLatitude`/`GPSLongitude` + refs → `location`, `Make` + `Model` → `camera`.
- Camera string format: `"Make Model"` (e.g., `"Apple iPhone 15 Pro"`). Trim and deduplicate if Make appears in Model.

---

## Phase 4: Cosmos DB Update Logic — TDD (WBS 4)

### Task 4.1: Success path — updates Cosmos with `status: ready` + metadata

**Test file:** `tests/unit/functions/metadata-extraction/handler.test.ts`

```
Given: blob.read returns a valid PNG buffer
When:  extractMetadata({ hash: "abc" }, deps) is called
Then:  cosmos.update("abc", { status: "ready", width: 1, height: 1, exif: null }) is called
```

### Task 4.2: Extraction failure — updates Cosmos with `status: failed`

```
Given: blob.read returns a corrupted buffer (dimension extraction throws)
When:  extractMetadata({ hash: "abc" }, deps) is called
Then:  cosmos.update("abc", { status: "failed" }) is called
       Function does NOT throw
```

### Task 4.3: No retry on failure

```
Given: extraction fails
When:  extractMetadata completes
Then:  Function resolves normally (does not throw)
       No retry mechanism invoked
```

### Task 4.4: Blob not found — sets `status: failed`

```
Given: blob.read throws "not found"
When:  extractMetadata({ hash: "abc" }, deps) is called
Then:  cosmos.update("abc", { status: "failed" }) is called
       Function does NOT throw
```

---

## Phase 5: Handler Integration — TDD (WBS 5)

### Task 5.1: Full success path end-to-end

**Test file:** `tests/unit/functions/metadata-extraction/handler.test.ts`

```
Given: BlobClientMock has a valid JPEG with EXIF
       CosmosClientMock has a document with status: processing
When:  extractMetadata({ hash }, deps) is called
Then:  cosmos.update called with status: ready, width, height, exif data
```

### Task 5.2: Processing completes without hanging

```
Given: valid setup
When:  extractMetadata is called
Then:  Promise resolves (no hanging promises, no unhandled rejections)
```

### Task 5.3: Invalid message format

```
Given: message has no hash field (e.g., {})
When:  extractMetadata(message, deps) is called
Then:  Function handles gracefully (no crash), logs error or returns early
```

### Task 5.4: Implement handler business logic

**File:** `src/functions/metadata-extraction/handler.ts`

Implementation pseudocode:

```
1. Validate message has hash field
2. try:
     buffer = await deps.blob.read(message.hash)
     dimensions = extractDimensions(buffer)
     exif = extractExif(buffer)
     await deps.cosmos.update(message.hash, {
       status: "ready",
       width: dimensions.width,
       height: dimensions.height,
       exif: exif,
     })
   catch:
     await deps.cosmos.update(message.hash, { status: "failed" })
```

---

## Phase 6: Function Entry Point (WBS 7)

### Task 6.1: Create `index.system.ts`

**File:** `src/functions/metadata-extraction/index.system.ts`

This is a `*.system.ts` file — excluded from coverage. Contains:

- Azure Functions Service Bus trigger registration
- Queue name: `image-metadata-extraction`
- Message parsing (extract `hash` from body)
- Instantiate real dependencies (Cosmos SDK client, Blob SDK client)
- Call `extractMetadata(message, deps)`
- Auto-complete message on success; dead-letter on unrecoverable failure

**Implementation notes:**
- Uses `@azure/functions` v4 programming model
- Real SDK clients (`CosmosClient`, `BlobServiceClient`) are instantiated here
- Managed identity for authentication (no connection strings in code)
- This file has zero business logic — only wiring

### Task 6.2: Message completion configuration

- On success: message auto-completes (default Service Bus behavior)
- On failure: function does not throw → message completes normally
- Dead-letter: only for poison messages (handled by Service Bus max delivery count = 1)

---

## Phase 7: Quality Gate

### Task 7.1: Run full quality suite

```bash
task quality
```

Verify:
- [ ] Lint: zero errors
- [ ] Typecheck: zero errors
- [ ] Tests: all pass
- [ ] Coverage: ≥ 80% line, ≥ 80% statement, ≥ 60% function

### Task 7.2: Verify coverage targets

- `handler.ts`: ≥ 80% line coverage
- `extraction.ts`: ≥ 80% line coverage
- `index.system.ts`: excluded from coverage (`*.system.ts` pattern)

### Task 7.3: Manual review checklist

- [ ] No `console.log` in production code
- [ ] No secrets or credentials in source
- [ ] All external I/O behind interfaces
- [ ] Dependency injection used (no SDK clients instantiated in handlers)
- [ ] Test isolation (mocks scoped to each `test()` block)
- [ ] Conventional commit messages used

---

## File Summary

| File | Layer | Coverage | Phase |
|------|-------|----------|-------|
| `src/functions/metadata-extraction/handler.ts` | Business Logic | Included (≥ 80%) | 2, 4, 5 |
| `src/functions/metadata-extraction/extraction.ts` | Business Logic | Included (≥ 80%) | 3 |
| `src/functions/metadata-extraction/index.system.ts` | Framework/Driver | Excluded | 6 |
| `tests/unit/functions/metadata-extraction/handler.test.ts` | Tests | N/A | 4, 5 |
| `tests/unit/functions/metadata-extraction/extraction.test.ts` | Tests | N/A | 3 |

---

## Dependency Graph

```
Phase 1: Setup & Dependencies
    │
    ├── Phase 2: Handler Interface Design (types + signatures)
    │       │
    │       ├── Phase 4: Cosmos Update TDD (needs handler signature + mocks)
    │       │       │
    │       │       └── Phase 5: Handler Integration TDD (needs Phases 3 + 4)
    │       │               │
    │       │               └── Phase 6: Entry Point Wiring (needs Phase 5)
    │       │                       │
    │       │                       └── Phase 7: Quality Gate
    │       │
    │       └── Phase 3: Pure Extraction Utilities TDD (no deps on interfaces)
    │               │
    │               └── (feeds into Phase 5)
    │
```

Phases 3 and 4 can proceed in parallel after Phase 2 is complete.

---

## Estimated Task Count

| Phase | Tasks | Tests |
|-------|-------|-------|
| Phase 1: Setup | 3 | 0 |
| Phase 2: Interface Design | 3 | 0 |
| Phase 3: Extraction Utilities | 4 (≈15 test cases) | 15 |
| Phase 4: Cosmos Update | 4 (≈4 test cases) | 4 |
| Phase 5: Handler Integration | 4 (≈3 test cases) | 3 |
| Phase 6: Entry Point | 2 | 0 |
| Phase 7: Quality Gate | 3 | 0 |
| **Total** | **23** | **22** |
