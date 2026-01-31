# PRD: Upload Pipeline (POST /images)

**Version:** 1.0
**Author:** Claude Code
**Date:** 31 January 2026
**Status:** Draft
**Epic Reference:** EPIC.md — Epic 2 (Story 2.1)
**Priority:** P1

---

## Background

### Problem Statement

The CDN API needs an upload endpoint that accepts raw image binary data, computes a content-addressed hash, stores the image in Blob Storage, creates a metadata record in Cosmos DB, and queues an async message for metadata extraction. This entire flow is implemented as an APIM inbound/outbound policy — no custom function code is needed.

### System Context

The upload pipeline is the primary entry point for the system. It is implemented entirely within Azure APIM policies, directly interacting with Azure backend services (Blob Storage, Cosmos DB, Service Bus).

```
Client → APIM (POST /images)
           ├─ Validate Content-Type
           ├─ Compute SHA-256 hash (base64url)
           ├─ Check Cosmos for existing doc
           │   ├─ Exists → return existing (201)
           │   └─ New →
           │        ├─ Write blob to /{hash}
           │        ├─ Create Cosmos doc (status: processing)
           │        ├─ Queue Service Bus message
           │        └─ Return 201 with metadata
```

### Dependencies

- **Depends on:** PRD 1 (Shared Domain — data model contract), PRD 2 (Infrastructure — all Azure resources)
- **Depended on by:** PRD 6 (Metadata Extraction — triggered by queued message)

---

## Objectives

### SMART Goals

- **Specific:** Implement the POST /images APIM policy that validates, hashes, stores, and queues images
- **Measurable:** P95 upload latency < 500ms for images under 5MB (EPIC §7)
- **Achievable:** APIM policies support all required operations (C# expressions, send-request, set-body)
- **Relevant:** Core upload flow that enables all other API operations
- **Time-bound:** Deployable after infrastructure provisioning is complete

### Key Performance Indicators

| KPI | Target |
|-----|--------|
| POST latency (P95) | < 500ms for images ≤ 5MB |
| Content-Type validation | Rejects all unsupported types with 400 |
| Deduplication | Same image uploaded twice returns same document |
| Error responses | Correct HTTP codes: 201, 400, 401, 413 |

---

## Features

### Feature 1: Request Validation

Validate incoming request content type, body presence, and size before processing.

### Feature 2: Content-Addressed Hashing

Compute SHA-256 hash of the request body and encode as base64url (RFC 4648, no padding).

### Feature 3: Deduplication Check

Query Cosmos DB to check if an image with the same hash already exists, returning the existing document if so.

### Feature 4: Backend Storage

Write the image blob and create the Cosmos DB metadata document.

### Feature 5: Async Queue

Send a message to Service Bus to trigger metadata extraction.

---

## Work Breakdown Structure

### WBS 1: Request Validation Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 1.1 | Validate `Content-Type` header | Accept only `image/png`, `image/jpeg`, `image/gif`, `image/webp`; return 400 for all others |
| 1.2 | Validate request body is not empty | Return 400 with error message for empty body |
| 1.3 | Enforce 25MB size limit | Return 413 Payload Too Large if body exceeds `MAX_IMAGE_SIZE` |

**Policy Section:** `<inbound>` — `<choose>` with `<when>` conditions

---

### WBS 2: Hash Computation Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 2.1 | Compute SHA-256 hash of request body | Use APIM C# expression: `Convert.ToBase64String(SHA256.Create().ComputeHash(body))` |
| 2.2 | Convert to base64url encoding | Replace `+` with `-`, `/` with `_`, remove `=` padding |
| 2.3 | Store hash in context variable | `context.Variables["hash"]` available for downstream steps |
| 2.4 | Validate hash length is 43 characters | Defensive check matching EPIC §4.3 specification |

**Policy Section:** `<inbound>` — `<set-variable>` with C# expression

---

### WBS 3: Deduplication Check Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 3.1 | Query Cosmos DB for existing document by hash | `<send-request>` to Cosmos DB REST API with hash as id and partition key |
| 3.2 | Parse Cosmos response | Check for 200 (exists) vs 404 (new) |
| 3.3 | Return existing document if found | Short-circuit with 201 response containing existing document |

**Policy Section:** `<inbound>` — `<send-request>` + `<choose>`

---

### WBS 4: Blob Storage Write Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 4.1 | Write blob to `/{hash}` path | `<send-request>` PUT to Blob Storage REST API |
| 4.2 | Set Content-Type on blob | Pass through original request `Content-Type` header |
| 4.3 | Handle write failure | Return 500 if blob write fails |

**Policy Section:** `<inbound>` — `<send-request>` PUT to blob endpoint

---

### WBS 5: Cosmos DB Document Creation Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 5.1 | Construct Cosmos document JSON | Fields: `id` (hash), `url` (CDN_BASE_URL + hash), `status` ("processing"), `size` (body length), `contentType`, `width` (null), `height` (null), `exif` (null), `createdAt` (UTC ISO 8601), `ttl` (604800) |
| 5.2 | Create document via Cosmos REST API | `<send-request>` POST to Cosmos DB |
| 5.3 | Handle creation failure | Return 500 if Cosmos write fails |

**Policy Section:** `<inbound>` — `<send-request>` POST to Cosmos endpoint

---

### WBS 6: Service Bus Queue Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 6.1 | Construct Service Bus message | Message body: JSON `{ "hash": "{hash}" }` |
| 6.2 | Send message to `image-metadata-extraction` queue | `<send-request>` POST to Service Bus REST API |
| 6.3 | Handle queue failure gracefully | Log warning but do not fail the request (metadata extraction is best-effort) |

**Policy Section:** `<inbound>` — `<send-request>` POST to Service Bus

---

### WBS 7: Response Construction Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 7.1 | Construct 201 response body | JSON: `{ "id", "url", "status", "size", "contentType", "createdAt" }` |
| 7.2 | Set response headers | `Content-Type: application/json` |
| 7.3 | Return 201 Created | Both for new uploads and deduplicated returns |

**Policy Section:** `<outbound>` — `<return-response>` with `<set-body>`

---

### WBS 8: Policy Assembly (`policies/post-images.xml`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 8.1 | Assemble complete policy XML | Compose all WBS 1–7 into single APIM policy file |
| 8.2 | Add authentication expressions | Use managed identity for backend service calls |
| 8.3 | Add error handling | `<on-error>` section with appropriate HTTP error codes |
| 8.4 | Add CORS headers if needed | Optional: support cross-origin requests |

---

## File Summary

| File | Purpose |
|------|---------|
| `policies/post-images.xml` | Complete APIM inbound/outbound policy for POST /images |

---

## Milestones

| Phase | Deliverables | Dependencies |
|-------|-------------|-------------|
| Phase 1 | Request validation (WBS 1) | PRD 2 (APIM deployed) |
| Phase 2 | Hash computation + dedup check (WBS 2–3) | Phase 1 + Cosmos DB deployed |
| Phase 3 | Blob write + Cosmos create (WBS 4–5) | Phase 2 + Blob Storage deployed |
| Phase 4 | Service Bus queue + response (WBS 6–7) | Phase 3 + Service Bus deployed |
| Phase 5 | Full policy assembly and testing (WBS 8) | Phases 1–4 |

---

## API Contract

### Request

| Field | Value |
|-------|-------|
| Method | POST |
| Path | `/cdn/v1/images` |
| Content-Type | `image/png` \| `image/jpeg` \| `image/gif` \| `image/webp` |
| Body | Raw image binary (max 25MB) |
| Auth | mTLS + `Ocp-Apim-Subscription-Key` header |

### Response

| Code | Body | Condition |
|------|------|-----------|
| 201 Created | `{ "id", "url", "status": "processing", "size", "contentType", "createdAt" }` | New or duplicate upload |
| 400 Bad Request | `{ "error": "..." }` | Invalid Content-Type or empty body |
| 401 Unauthorized | N/A | Invalid mTLS cert or subscription key |
| 413 Payload Too Large | `{ "error": "..." }` | Body exceeds 25MB |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| APIM policy complexity | Break into modular `<fragment>` policies; test each step independently |
| Hash computation performance for large images | APIM buffering; P95 target only for images ≤ 5MB |
| Partial failure (blob written, Cosmos fails) | Accept orphaned blobs — 7-day TTL auto-cleans; log for monitoring |
| Service Bus queue failure | Best-effort queue; image still accessible, metadata stays "processing" |
