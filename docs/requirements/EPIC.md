# Product Requirements Document: Edge Cache CDN API

- **Version:** 1.2
- **Author:** Tobias Lekman
- **Date:** 31 January 2026
- **Status:** Draft

---

## 1. Overview

Content-addressed image storage and distribution using Cloudflare CDN with Azure backend. Images stored by SHA-256 hash (immutable, no cache invalidation). Metadata extracted asynchronously, stored in Cosmos DB.

### 1.1 Goals

Priority order: easy integration, reliability, cost efficiency, performance.

### 1.2 Architecture Summary

```
POST /images
  → APIM: auth, hash, write blob, create Cosmos doc (status:processing), queue message
  → (async) Function: extract metadata, update Cosmos (status:ready|failed)

GET /images/{hash}
  → APIM: query Cosmos, return metadata

DELETE /images/{hash}
  → APIM → Function (sync): delete blob, delete Cosmos, purge Cloudflare

Image delivery: img.lekman.com/{hash} → Cloudflare → Azure Blob
```

---

## 2. Components

| Component | Purpose | Config |
|-----------|---------|--------|
| Cloudflare CDN | Edge cache, image optimisation, SSL | img.lekman.com |
| Azure APIM | API gateway, auth, rate limiting | api.lekman.com/cdn/v1 |
| Azure Blob Storage | Origin storage | Hot tier, LRS, 7-day TTL |
| Azure Cosmos DB | Metadata store | Serverless, 7-day TTL |
| Azure Service Bus | Async processing queue | Basic tier |
| Azure Functions | Metadata extraction, delete+purge | Consumption plan |

---

## 3. API Specification

### 3.1 Base URL & Auth

```
https://api.lekman.com/cdn/v1
```

Authentication: mTLS (client certificate) + subscription key header (`Ocp-Apim-Subscription-Key`).

### 3.2 POST /images

Upload image. Returns CDN URL. Metadata extraction is async.

**Request:**

| Field | Value |
|-------|-------|
| Content-Type | `image/png` \| `image/jpeg` \| `image/gif` \| `image/webp` |
| Body | Raw image binary (max 25MB) |

**Response:**

| Code | Description |
|------|-------------|
| 201 Created | Metadata document with `status:processing` |
| 400 Bad Request | Invalid content type or empty body |
| 401 Unauthorized | Invalid credentials |
| 413 Payload Too Large | Exceeds 25MB |

### 3.3 GET /images/{hash}

Retrieve metadata. Status indicates extraction state.

**Response:**

| Code | Description |
|------|-------------|
| 200 OK | Metadata document |
| 404 Not Found | Image does not exist |

### 3.4 DELETE /images/{hash}

Delete from storage, Cosmos, and Cloudflare. Synchronous.

**Response:**

| Code | Description |
|------|-------------|
| 204 No Content | Deleted and purged |
| 404 Not Found | Image does not exist |
| 502 Bad Gateway | Cloudflare purge failed (storage deleted) |

---

## 4. Data Model

### 4.1 Cosmos DB Document

```json
{
  "id": "{hash}",                              // Partition key
  "url": "https://img.lekman.com/{hash}",
  "status": "processing|ready|failed",
  "size": 245678,                              // Bytes
  "contentType": "image/jpeg",
  "width": 1920,                               // Null until ready
  "height": 1080,                              // Null until ready
  "exif": {                                    // Null if not present or failed
    "created": "2025-01-15T14:30:00Z",
    "location": { "lat": 51.5074, "lon": -0.1278 },
    "camera": "iPhone 15 Pro"
  },
  "createdAt": "2026-01-31T10:00:00Z",
  "ttl": 604800                                // 7 days
}
```

### 4.2 Status Values

| Status | Meaning |
|--------|---------|
| `processing` | Upload complete, metadata extraction pending |
| `ready` | Metadata extracted successfully |
| `failed` | Metadata extraction failed. Image accessible, no dimensions/EXIF. No retry. |

### 4.3 Hash Specification

| Property | Value |
|----------|-------|
| Algorithm | SHA-256 |
| Encoding | Base64url (RFC 4648), no padding |
| Length | 43 characters |
| Example | `LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564` |

---

## 5. Implementation Tasks

Suggested Jira structure. Each epic contains stories with acceptance criteria.

### Epic 1: Infrastructure

#### Story 1.1: Provision Azure Resources

Create Bicep/Terraform for all Azure infrastructure.

**Acceptance Criteria:**
- AC1: Storage account created with blob container, public access enabled, 7-day lifecycle policy
- AC2: Cosmos DB account created (serverless), database and container with `/id` partition key, TTL enabled
- AC3: Service Bus namespace and queue (`image-metadata-extraction`) created
- AC4: Function App created with managed identity, connected to storage/Cosmos/Service Bus
- AC5: All resources deployed via CI/CD pipeline

#### Story 1.2: Configure APIM

Set up API Management with policies.

**Acceptance Criteria:**
- AC1: API defined at `/cdn/v1` with three operations (POST, GET, DELETE)
- AC2: mTLS configured with client certificate validation
- AC3: Subscription key validation enabled
- AC4: Rate limiting policy applied
- AC5: Request size limit (25MB) enforced

#### Story 1.3: Configure Cloudflare

Set up Cloudflare zone and origin.

**Acceptance Criteria:**
- AC1: DNS record for img.lekman.com pointing to Cloudflare
- AC2: Origin configured to Azure Blob Storage endpoint
- AC3: Cache rules set: `Cache-Control: public, max-age=604800, immutable`
- AC4: Polish (image optimisation) enabled
- AC5: WebP conversion enabled
- AC6: API token created for purge operations, stored in Key Vault

---

### Epic 2: POST /images

#### Story 2.1: APIM Upload Policy

Implement inbound/outbound policy for image upload.

**Acceptance Criteria:**
- AC1: Policy validates Content-Type (`image/png`, `image/jpeg`, `image/gif`, `image/webp`)
- AC2: Policy computes SHA-256 hash of request body, encodes as base64url
- AC3: Policy writes blob to storage at `/{hash}` with correct Content-Type
- AC4: Policy creates Cosmos document with `status:processing`, size, contentType, createdAt, ttl
- AC5: Policy sends message to Service Bus queue with hash
- AC6: Policy returns 201 with JSON body: `{id, url, status, size, contentType, createdAt}`
- AC7: Duplicate upload (same hash) returns existing document

---

### Epic 3: GET /images/{hash}

#### Story 3.1: APIM Metadata Policy

Implement policy to retrieve metadata from Cosmos.

**Acceptance Criteria:**
- AC1: Policy extracts `{hash}` from URL path
- AC2: Policy queries Cosmos DB by id and partition key
- AC3: Returns 200 with full document if found
- AC4: Returns 404 if document does not exist

---

### Epic 4: DELETE /images/{hash}

#### Story 4.1: Delete Function

Implement HTTP-triggered function for synchronous delete.

**Acceptance Criteria:**
- AC1: Function receives hash as path parameter
- AC2: Function deletes blob from storage (succeeds silently if not exists)
- AC3: Function deletes document from Cosmos (succeeds silently if not exists)
- AC4: Function calls Cloudflare purge API for `img.lekman.com/{hash}`
- AC5: Returns 204 on success
- AC6: Returns 502 if Cloudflare purge fails (after storage/Cosmos deleted)
- AC7: Cloudflare API token retrieved from Key Vault

#### Story 4.2: APIM Delete Policy

Route DELETE to function.

**Acceptance Criteria:**
- AC1: Policy routes to Delete Function URL
- AC2: Policy passes through function response code

---

### Epic 5: Metadata Extraction

#### Story 5.1: Extraction Function

Implement Service Bus-triggered function for async metadata extraction.

**Acceptance Criteria:**
- AC1: Function triggered by Service Bus queue message
- AC2: Function reads blob from storage
- AC3: Function extracts width, height from image headers
- AC4: Function extracts EXIF data if present: DateTimeOriginal, GPS coordinates, Make/Model
- AC5: On success: updates Cosmos document with metadata, sets `status:ready`
- AC6: On failure: sets `status:failed`, logs error, no retry
- AC7: Processing completes within 30 seconds

---

## 6. Configuration Reference

### 6.1 Azure Blob Storage

```
Container: images
Access: Blob (public read)
Tier: Hot
Redundancy: LRS
Lifecycle: Delete after 7 days
```

### 6.2 Azure Cosmos DB

```
API: NoSQL
Database: cdn
Container: images
Partition key: /id
Capacity: Serverless
TTL: Enabled (per-document)
```

### 6.3 Azure Service Bus

```
Tier: Basic
Queue: image-metadata-extraction
Message TTL: 1 hour
Max delivery count: 1 (no retry)
```

### 6.4 Cloudflare

```
Domain: img.lekman.com
Origin: {storage-account}.blob.core.windows.net
Cache-Control: public, max-age=604800, immutable
Features: Polish, WebP conversion
Purge: Single-file via API
```

---

## 7. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Availability | 99.9% (CDN); API per Azure SLA |
| POST latency (P95) | < 500ms for images under 5MB |
| GET latency (P95) | < 50ms |
| CDN latency (P95) | < 50ms edge hit |
| Metadata extraction | < 30 seconds from upload |
| Max image size | 25MB |
| Data retention | 7 days (blob + Cosmos TTL) |

---

## 8. Out of Scope

- Query or list operations
- Update operations
- Image transformation at upload
- Long-term storage
- Access logging/analytics
- Retry on metadata extraction failure
