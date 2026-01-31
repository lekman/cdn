# PRD: Metadata Retrieval (GET /images/{hash})

**Version:** 1.0
**Author:** Claude Code
**Date:** 31 January 2026
**Status:** Draft
**Epic Reference:** EPIC.md — Epic 3 (Story 3.1)
**Priority:** P1

---

## Background

### Problem Statement

Clients need to retrieve metadata for previously uploaded images to check processing status (processing/ready/failed) and access extracted metadata (dimensions, EXIF data). This is a simple read-through to Cosmos DB implemented as an APIM policy.

### System Context

The metadata retrieval endpoint is the simplest of the three API operations. It performs a single Cosmos DB point-read using the hash as both the document ID and partition key, ensuring minimal latency.

```
Client → APIM (GET /images/{hash})
           ├─ Extract {hash} from URL path
           ├─ Query Cosmos DB by id + partition key
           │   ├─ Found → return 200 with document
           │   └─ Not found → return 404
```

### Dependencies

- **Depends on:** PRD 2 (Infrastructure — Cosmos DB, APIM)
- **Depended on by:** Nothing (terminal read operation)

---

## Objectives

### SMART Goals

- **Specific:** Implement GET /images/{hash} APIM policy to retrieve metadata from Cosmos DB
- **Measurable:** P95 latency < 50ms (EPIC §7); correct 200/404 responses
- **Achievable:** Single Cosmos DB point-read via APIM send-request
- **Relevant:** Enables clients to poll for metadata extraction completion
- **Time-bound:** Deployable after infrastructure and upload pipeline

### Key Performance Indicators

| KPI | Target |
|-----|--------|
| GET latency (P95) | < 50ms |
| Correct 200 response | Returns full Cosmos document |
| Correct 404 response | Returns structured error for missing hash |
| Hash validation | Rejects malformed hash values |

---

## Features

### Feature 1: Path Parameter Extraction

Extract and validate the `{hash}` parameter from the URL path.

### Feature 2: Cosmos DB Point-Read

Query Cosmos DB using the hash as both document ID and partition key for optimal performance.

### Feature 3: Response Formatting

Return the full document on success or a structured 404 error on miss.

---

## Work Breakdown Structure

### WBS 1: Path Parameter Extraction

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 1.1 | Extract `{hash}` from URL path | Parse from `/cdn/v1/images/{hash}` using APIM template parameter |
| 1.2 | Validate hash format | 43-character base64url string; return 400 for invalid format |
| 1.3 | Store hash in context variable | `context.Variables["hash"]` available for Cosmos query |

**Policy Section:** `<inbound>` — `<set-variable>` with path extraction

---

### WBS 2: Cosmos DB Query

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 2.1 | Construct Cosmos DB point-read request | GET to `https://{cosmos-endpoint}/dbs/cdn/colls/images/docs/{hash}` with partition key header `x-ms-documentdb-partitionkey: ["{hash}"]` |
| 2.2 | Authenticate with managed identity | Use APIM `authentication-managed-identity` policy for Cosmos scope |
| 2.3 | Handle 200 response | Parse JSON document from Cosmos response body |
| 2.4 | Handle 404 response | Cosmos returns 404 when document does not exist |

**Policy Section:** `<inbound>` — `<send-request>` GET to Cosmos

---

### WBS 3: Response Construction

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 3.1 | Return 200 with full document | Forward complete Cosmos document as response body with `Content-Type: application/json` |
| 3.2 | Return 404 for missing document | JSON body: `{ "error": "Image not found", "hash": "{hash}" }` |
| 3.3 | Handle Cosmos errors | Return 500 for unexpected Cosmos failures |

**Policy Section:** `<outbound>` — `<choose>` with `<return-response>`

---

### WBS 4: Policy Assembly (`policies/get-image.xml`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 4.1 | Assemble complete policy XML | Compose WBS 1–3 into single APIM policy file |
| 4.2 | Add error handling | `<on-error>` section for unexpected failures |
| 4.3 | Set cache headers | Response `Cache-Control: no-cache` (metadata changes as processing completes) |

---

## File Summary

| File | Purpose |
|------|---------|
| `policies/get-image.xml` | Complete APIM policy for GET /images/{hash} |

---

## Milestones

| Phase | Deliverables | Dependencies |
|-------|-------------|-------------|
| Phase 1 | Path extraction + validation (WBS 1) | PRD 2 (APIM deployed) |
| Phase 2 | Cosmos point-read (WBS 2) | Phase 1 + Cosmos DB deployed |
| Phase 3 | Response formatting + assembly (WBS 3–4) | Phase 2 |

---

## API Contract

### Request

| Field | Value |
|-------|-------|
| Method | GET |
| Path | `/cdn/v1/images/{hash}` |
| Auth | mTLS + `Ocp-Apim-Subscription-Key` header |

### Response

| Code | Body | Condition |
|------|------|-----------|
| 200 OK | Full `ImageDocument` JSON | Document exists in Cosmos DB |
| 400 Bad Request | `{ "error": "Invalid hash format" }` | Hash fails base64url/length validation |
| 404 Not Found | `{ "error": "Image not found" }` | No document with given hash |

### Response Body (200)

```json
{
  "id": "{hash}",
  "url": "https://img.lekman.com/{hash}",
  "status": "processing|ready|failed",
  "size": 245678,
  "contentType": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "exif": { ... },
  "createdAt": "2026-01-31T10:00:00Z",
  "ttl": 604800
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Cosmos DB throttling under load | Serverless auto-scales; APIM rate limiting protects upstream |
| Stale data during metadata extraction | Response includes `status` field; clients poll until `ready` or `failed` |
| Hash collision (SHA-256) | Astronomically unlikely (2^128 security); no mitigation needed |
