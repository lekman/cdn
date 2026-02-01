---
title: Upload Pipeline (POST /images)
version: 0.1.0
author: Claude Code
date: 2026-01-31
status: draft
epic: EPIC.md
priority: P1
ticket-id: upload-pipeline
---

# Upload Pipeline (POST /images)

## Problem Statement

The CDN API needs an upload endpoint that accepts raw image binary data, computes a content-addressed hash, stores the image in Blob Storage, creates a metadata record in Cosmos DB, and queues an async message for metadata extraction. This entire flow is implemented as an APIM inbound/outbound policy — no custom function code is needed.

## User Personas

### API Consumer

External service authenticating via mTLS and subscription key. Uploads images and expects a content-addressed URL for CDN delivery. Needs fast, idempotent uploads with deduplication.

### Platform Operator

Manages APIM policies and monitors upload pipeline health. Needs clear error responses, logging, and graceful handling of partial failures.

## Vision Statement

A single APIM policy file (`policies/post-images.xml`) that validates, hashes, stores, deduplicates, and queues images — with no custom function code. Deterministic behavior: same image always produces same hash and same response.

## Market Opportunity

The upload endpoint is the system's primary entry point. Without it, no images enter the CDN pipeline. All downstream features (metadata retrieval, metadata extraction, deletion, CDN delivery) depend on images being uploaded first. This is a blocking dependency for the entire product.

## Architecture & Design

### Implementation Approach

The upload pipeline is implemented entirely as an Azure APIM policy XML file. No Azure Function or custom application code is needed. APIM policies support C# expressions for SHA-256 hashing, `send-request` for backend service calls, and `return-response` for short-circuiting.

### Data Flow

```
Client → APIM (POST /images)
           ├─ <inbound>
           │   ├─ Validate Content-Type, body, size
           │   ├─ Compute SHA-256 hash (base64url, 43 chars)
           │   ├─ send-request: Check Cosmos for existing doc
           │   │   ├─ Exists → return-response 201 (short-circuit)
           │   │   └─ New →
           │   │        ├─ send-request: PUT blob to /{hash}
           │   │        ├─ send-request: POST Cosmos doc
           │   │        └─ send-request: POST Service Bus message
           ├─ <backend>
           │   └─ (no backend — all handled in inbound)
           ├─ <outbound>
           │   └─ Construct 201 JSON response
           └─ <on-error>
               └─ Return appropriate HTTP error codes
```

### Technology Choices

| Choice | Rationale |
|--------|-----------|
| APIM policy (not Azure Function) | No cold start, no runtime to manage, policy executes inline |
| SHA-256 + base64url | Content-addressed, deterministic, collision-resistant |
| Cosmos DB REST API (not SDK) | APIM `send-request` calls REST directly; no SDK needed |
| Service Bus REST API | Same — direct REST calls from APIM policy |

## Domain Model

This PRD uses the domain types defined in PRD 1 (Shared Domain):

### ImageDocument (Cosmos DB)

```typescript
interface ImageDocument {
  id: string;          // SHA-256 base64url hash (43 chars)
  url: string;         // CDN_BASE_URL + "/" + id
  status: ImageStatus; // "processing" on upload
  size: number;        // Request body byte length
  contentType: string; // Original Content-Type header
  width: number | null;  // null until metadata extraction
  height: number | null; // null until metadata extraction
  exif: ExifData | null; // null until metadata extraction
  createdAt: string;     // UTC ISO 8601
  ttl: number;           // 604800 (7 days)
}
```

### Queue Message (Service Bus)

```json
{
  "hash": "<43-char base64url SHA-256>"
}
```

Queue: `image-metadata-extraction`, 1-hour message TTL, no automatic retry.

### Constants (from `src/shared/constants.ts`)

| Constant | Value | Usage |
|----------|-------|-------|
| `SUPPORTED_CONTENT_TYPES` | `image/png`, `image/jpeg`, `image/gif`, `image/webp` | Request validation |
| `MAX_IMAGE_SIZE` | 26214400 (25MB) | Size limit check |
| `HASH_LENGTH` | 43 | Hash validation |
| `DEFAULT_TTL` | 604800 (7 days) | Cosmos document TTL |
| `CDN_BASE_URL` | `https://img.lekman.com` | URL construction |

## Interface Boundaries

The APIM policy interacts with three backend services via REST APIs. All calls use managed identity for authentication.

### Cosmos DB REST API

| Operation | Method | Path | Auth |
|-----------|--------|------|------|
| Read document (dedup check) | GET | `/dbs/{db}/colls/{coll}/docs/{hash}` | Managed identity token |
| Create document | POST | `/dbs/{db}/colls/{coll}/docs` | Managed identity token |

Request headers: `x-ms-documentdb-partitionkey: ["{hash}"]`, `x-ms-version`, `Authorization`.

### Blob Storage REST API

| Operation | Method | Path | Auth |
|-----------|--------|------|------|
| Write blob | PUT | `/{container}/{hash}` | Managed identity token |

Request headers: `x-ms-blob-type: BlockBlob`, `Content-Type` (passthrough), `Authorization`.

### Service Bus REST API

| Operation | Method | Path | Auth |
|-----------|--------|------|------|
| Send message | POST | `/{queue}/messages` | Managed identity token |

Request headers: `Content-Type: application/json`, `Authorization`.

## Security Considerations

### Authentication

- Client authentication: mTLS (client certificate) + `Ocp-Apim-Subscription-Key` header
- Backend authentication: All `send-request` calls use managed identity tokens (no connection strings or API keys in policy)
- Token acquisition: APIM `authentication-managed-identity` element with appropriate resource URIs

### Input Validation

- Content-Type restricted to 4 image MIME types — rejects all others with 400
- Empty body rejected with 400
- Body size capped at 25MB — rejects with 413
- Hash computed from body content, not user-supplied — prevents hash injection

### Data Protection

- Images stored by content hash — no user-identifiable paths
- Cosmos documents have 7-day TTL — automatic cleanup
- No PII stored in metadata document
- Service Bus messages contain only the hash, not image data

## Core Features (Must Have)

### Request Validation

Validate incoming request content type, body presence, and size before processing.

- Accept only `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- Reject empty body with 400
- Enforce 25MB size limit with 413

### Content-Addressed Hashing

Compute SHA-256 hash of the request body and encode as base64url (RFC 4648, no padding). Result is 43 characters matching `^[A-Za-z0-9_-]{43}$`.

### Deduplication Check

Query Cosmos DB for an existing document with the computed hash. If found, return the existing document with 201 — skip storage and queuing.

### Backend Storage

Write image blob to `/{hash}` path in Blob Storage. Create Cosmos DB metadata document with status "processing", TTL 604800, and CDN URL.

### Async Queue

Send `{ "hash": "{hash}" }` message to Service Bus queue `image-metadata-extraction`. Queue failure is non-fatal — image is still accessible, metadata stays "processing".

### Response Construction

Return 201 Created with JSON body containing id, url, status, size, contentType, createdAt. Same response format for both new uploads and deduplicated returns.

## System Context

```
Client → APIM (POST /images)
           ├─ Validate Content-Type, body, size
           ├─ Compute SHA-256 hash (base64url)
           ├─ Check Cosmos for existing doc
           │   ├─ Exists → return existing (201)
           │   └─ New →
           │        ├─ Write blob to /{hash}
           │        ├─ Create Cosmos doc (status: processing)
           │        ├─ Queue Service Bus message
           │        └─ Return 201 with metadata
```

## Dependencies

- **Depends on:** PRD 1 (Shared Domain — data model contract), PRD 2 (Infrastructure — APIM, Blob, Cosmos, Service Bus deployed)
- **Depended on by:** PRD 5 (Metadata Extraction — triggered by queued message)

## Work Breakdown Structure

### WBS 1: Request Validation Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 1.1 | Validate Content-Type header | Accept only image/png, image/jpeg, image/gif, image/webp; return 400 for all others |
| 1.2 | Validate request body is not empty | Return 400 with error message for empty body |
| 1.3 | Enforce 25MB size limit | Return 413 Payload Too Large if body exceeds limit |

### WBS 2: Hash Computation Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 2.1 | Compute SHA-256 hash of request body | Use APIM C# expression with SHA256.Create().ComputeHash() |
| 2.2 | Convert to base64url encoding | Replace + with -, / with _, remove = padding |
| 2.3 | Store hash in context variable | context.Variables["hash"] available for downstream steps |
| 2.4 | Validate hash length is 43 characters | Defensive check matching EPIC specification |

### WBS 3: Deduplication Check Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 3.1 | Query Cosmos DB for existing document | send-request to Cosmos DB REST API with hash as id and partition key |
| 3.2 | Parse Cosmos response | Check for 200 (exists) vs 404 (new) |
| 3.3 | Return existing document if found | Short-circuit with 201 response containing existing document |

### WBS 4: Blob Storage Write Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 4.1 | Write blob to /{hash} path | send-request PUT to Blob Storage REST API |
| 4.2 | Set Content-Type on blob | Pass through original request Content-Type header |
| 4.3 | Handle write failure | Return 500 if blob write fails |

### WBS 5: Cosmos DB Document Creation Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 5.1 | Construct Cosmos document JSON | Fields: id, url, status, size, contentType, width (null), height (null), exif (null), createdAt, ttl |
| 5.2 | Create document via Cosmos REST API | send-request POST to Cosmos DB |
| 5.3 | Handle creation failure | Return 500 if Cosmos write fails |

### WBS 6: Service Bus Queue Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 6.1 | Construct Service Bus message | Message body: JSON with hash field |
| 6.2 | Send message to queue | send-request POST to Service Bus REST API |
| 6.3 | Handle queue failure gracefully | Log warning but do not fail the request |

### WBS 7: Response Construction Policy

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 7.1 | Construct 201 response body | JSON with id, url, status, size, contentType, createdAt |
| 7.2 | Set response headers | Content-Type: application/json |
| 7.3 | Return 201 Created | Both for new uploads and deduplicated returns |

### WBS 8: Policy Assembly

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 8.1 | Assemble complete policy XML | Compose WBS 1-7 into policies/post-images.xml |
| 8.2 | Add authentication expressions | Managed identity for backend service calls |
| 8.3 | Add error handling | on-error section with HTTP error codes |

## Test Strategy

This PRD follows the project TDD workflow: **RED → GREEN → REFACTOR**.

### Policy Structure Tests (RED → GREEN)

APIM policies are XML files. Write failing tests first, then implement:

1. Parse `policies/post-images.xml` — verify XML well-formedness
2. Assert required APIM elements present: `<inbound>`, `<backend>`, `<outbound>`, `<on-error>`
3. Assert context variable names consistent across policy sections
4. Assert `authentication-managed-identity` present in all `send-request` calls

### Contract Validation Tests (RED → GREEN)

Verify the policy structure matches the API contract:

1. Assert 201 response body template contains required fields: id, url, status, size, contentType, createdAt
2. Assert 400 error response template includes error message field
3. Assert 413 error response for oversized payload
4. Assert Content-Type validation covers all 4 supported MIME types

### Refactor

After tests pass, refactor policy XML for readability:
- Extract repeated authentication blocks
- Ensure consistent variable naming
- Verify error messages are clear

### Integration Tests (Post-Deployment)

Require deployed infrastructure (PRD 2). Out of scope for this PRD's CI gate:

- Upload image, verify blob exists
- Upload image, verify Cosmos document created
- Upload same image twice, verify deduplication
- Upload image, verify Service Bus message queued

## Acceptance Criteria

1. `policies/post-images.xml` is valid APIM policy XML with `<inbound>`, `<backend>`, `<outbound>`, `<on-error>` sections
2. Given a request with Content-Type `image/png`, `image/jpeg`, `image/gif`, or `image/webp`, when the image is uploaded, then the request is accepted
3. Given a request with an unsupported Content-Type, when the upload is attempted, then a 400 Bad Request is returned with an error message
4. Given a request with an empty body, when the upload is attempted, then a 400 Bad Request is returned
5. Given a request body exceeding 25MB, when the upload is attempted, then a 413 Payload Too Large is returned
6. Given a valid image upload, when the hash is computed, then it is SHA-256 encoded as base64url (43 characters, matching `^[A-Za-z0-9_-]{43}$`)
7. Given an image that already exists in Cosmos DB, when the same image is uploaded again, then the existing document is returned with 201 (no new blob written)
8. Given a new image upload, when storage succeeds, then the blob is written to `/{hash}` in Blob Storage
9. Given a new image upload, when Cosmos document is created, then it has `status: "processing"` and `ttl: 604800`
10. Given a new image upload, when the Service Bus message is sent, then the message body contains `{ "hash": "{hash}" }`
11. Given a Service Bus send failure, when the upload completes, then the upload still succeeds (queue is best-effort)
12. Given a successful upload (new or duplicate), when the response is returned, then it is 201 Created with JSON body containing: id, url, status, size, contentType, createdAt
13. Given any backend `send-request` call, when authentication is configured, then managed identity is used (no hardcoded credentials)
14. Given an unexpected error, when the `<on-error>` section handles it, then an appropriate HTTP error code is returned

## API Contract

### Request

| Field | Value |
|-------|-------|
| Method | POST |
| Path | /cdn/v1/images |
| Content-Type | image/png, image/jpeg, image/gif, or image/webp |
| Body | Raw image binary (max 25MB) |
| Auth | mTLS + Ocp-Apim-Subscription-Key header |

### Response

| Code | Body | Condition |
|------|------|-----------|
| 201 Created | JSON with id, url, status, size, contentType, createdAt | New or duplicate upload |
| 400 Bad Request | JSON with error field | Invalid Content-Type or empty body |
| 401 Unauthorized | N/A | Invalid mTLS cert or subscription key |
| 413 Payload Too Large | JSON with error field | Body exceeds 25MB |

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| APIM policy complexity | Break into modular sections; test each step independently |
| Hash computation performance for large images | APIM buffering; P95 target only for images at or below 5MB |
| Partial failure (blob written, Cosmos fails) | Accept orphaned blobs — 7-day TTL auto-cleans |
| Service Bus queue failure | Best-effort queue; image still accessible, metadata stays "processing" |

## File Summary

| File | Purpose |
|------|---------|
| policies/post-images.xml | Complete APIM inbound/outbound policy for POST /images |
