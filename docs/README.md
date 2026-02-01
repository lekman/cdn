# Edge Cache CDN API

Content-addressed image storage and distribution using Cloudflare CDN with Azure backend.

## Overview

`@lekman/cdn` is a temporary image hosting API. Clients upload images via a REST API, receive a content-addressed CDN URL (`img.lekman.com/{sha256}`), and images auto-expire after 7 days. Metadata (dimensions, EXIF) is extracted asynchronously after upload.

Images are stored by SHA-256 hash — the same image uploaded twice returns the same URL. Content at a given hash never changes, so cache invalidation is unnecessary.

## Architecture

```
Client → api.lekman.com/cdn/v1
           ├─ POST /images       Upload image, get CDN URL
           ├─ GET /images/{hash} Retrieve metadata
           └─ DELETE /images/{hash} Delete + purge cache

Image delivery: img.lekman.com/{hash} → Cloudflare CDN → Azure Blob Storage
```

| Component | Purpose |
|-----------|---------|
| Cloudflare CDN | Edge cache, image optimisation, SSL (`img.lekman.com`) |
| Azure APIM | API gateway, mTLS auth, rate limiting (`api.lekman.com/cdn/v1`) |
| Azure Blob Storage | Origin storage (hot tier, LRS, 7-day lifecycle) |
| Azure Cosmos DB | Metadata store (serverless, 7-day TTL) |
| Azure Service Bus | Async processing queue for metadata extraction |
| Azure Functions | Metadata extraction (Service Bus trigger), delete+purge (HTTP trigger) |
| Azure Key Vault | Cloudflare API token storage |

## API

### Authentication

mTLS (client certificate) + subscription key header (`Ocp-Apim-Subscription-Key`).

### POST /images

Upload an image. Returns a CDN URL and metadata document. Metadata extraction is async.

```
POST https://api.lekman.com/cdn/v1/images
Content-Type: image/jpeg
Body: <raw image binary, max 25MB>

201 Created
{
  "id": "LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564",
  "url": "https://img.lekman.com/LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564",
  "status": "processing",
  "size": 245678,
  "contentType": "image/jpeg",
  "createdAt": "2026-01-31T10:00:00Z"
}
```

Supported content types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`.

Duplicate uploads (same content hash) return the existing document.

| Status | Description |
|--------|-------------|
| 201 | Created — metadata extraction pending |
| 400 | Invalid content type or empty body |
| 401 | Invalid credentials |
| 413 | Exceeds 25MB |

### GET /images/{hash}

Retrieve image metadata. The `status` field indicates extraction state.

```
GET https://api.lekman.com/cdn/v1/images/LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564

200 OK
{
  "id": "LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564",
  "url": "https://img.lekman.com/LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564",
  "status": "ready",
  "size": 245678,
  "contentType": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "exif": {
    "created": "2025-01-15T14:30:00Z",
    "location": { "lat": 51.5074, "lon": -0.1278 },
    "camera": "iPhone 15 Pro"
  },
  "createdAt": "2026-01-31T10:00:00Z"
}
```

| Status | Description |
|--------|-------------|
| 200 | Metadata document |
| 404 | Image does not exist |

### DELETE /images/{hash}

Delete image from storage, Cosmos DB, and Cloudflare cache. Synchronous.

```
DELETE https://api.lekman.com/cdn/v1/images/LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564

204 No Content
```

| Status | Description |
|--------|-------------|
| 204 | Deleted and cache purged |
| 404 | Image does not exist |
| 502 | Cloudflare purge failed (storage already deleted) |

## Image Delivery

Images are served directly from Cloudflare CDN at `img.lekman.com/{hash}`:

```
https://img.lekman.com/LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564
```

- Cache-Control: `public, max-age=604800, immutable`
- Cloudflare Polish (image optimisation) enabled
- WebP conversion enabled
- Edge cache hit latency: < 50ms (P95)

## Content Hash

| Property | Value |
|----------|-------|
| Algorithm | SHA-256 |
| Encoding | Base64url (RFC 4648), no padding |
| Length | 43 characters |
| Example | `LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564` |

## Metadata Status Values

| Status | Meaning |
|--------|---------|
| `processing` | Upload complete, metadata extraction pending |
| `ready` | Dimensions and EXIF extracted successfully |
| `failed` | Extraction failed — image accessible via CDN, no dimensions/EXIF, no retry |

## Data Retention

All data expires automatically after 7 days:

- Blob Storage: 7-day lifecycle policy
- Cosmos DB: per-document TTL (`604800` seconds)
- Cloudflare cache: 7-day max-age

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Availability | 99.9% (CDN); API per Azure SLA |
| POST latency (P95) | < 500ms for images under 5MB |
| GET latency (P95) | < 50ms |
| CDN latency (P95) | < 50ms edge hit |
| Metadata extraction | < 30 seconds from upload |
| Max image size | 25MB |
| Data retention | 7 days |

## Out of Scope

- Query or list operations (clients track their own hashes)
- Update operations (content-addressed, immutable)
- Image transformation at upload
- Long-term storage
- Access logging/analytics
- Retry on metadata extraction failure

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Task](https://taskfile.dev/) runner
- [Semgrep](https://semgrep.dev/) for security scanning

### Setup

```bash
task install      # Install tools and dependencies
task quality      # Run all quality checks
```

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `task install` | `i` | Install all tools and dependencies |
| `task lint` | `l` | Run Biome linting |
| `task format` | `fmt` | Format code with Biome |
| `task typecheck` | `tc` | TypeScript type checking |
| `task test` | `t` | Run unit tests |
| `task test:coverage` | `cov` | Tests with coverage report |
| `task quality` | `q` | Run lint + typecheck + security + test |
| `task setup:repo` | `setup` | Configure GitHub repository secrets |

## Documentation

| Document | Audience | Content |
|----------|----------|---------|
| [Architecture](ARCHITECTURE.md) | Contributors | C4 diagrams, component overview, data flows |
| [Contributing](CONTRIBUTING.md) | Contributors | Dev setup, task commands, CI/CD, release process |
| [Quality Assurance](QA.md) | Contributors | Test strategy, TDD workflow, coverage targets |
| [Security](SECURITY.md) | Security researchers | Vulnerability reporting, threat model |
| [Requirements](requirements/EPIC.md) | Stakeholders | Product Requirements Document |
| [Policy Guides](policies/README.md) | Contributors | Architecture, testing, and TypeScript pattern references |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, PR process, and commit conventions.

## License

[MIT](../LICENSE)
