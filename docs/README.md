# Edge Cache CDN API

Content-addressed image storage and distribution using Cloudflare CDN with Azure backend.

## Overview

`@lekman/cdn` is a temporary image hosting API. Clients upload images via a REST API, receive a content-addressed CDN URL (`img.lekman.com/{sha256}`), and images auto-expire after 7 days. Metadata (dimensions, EXIF) is extracted asynchronously after upload.

Images are stored by SHA-256 hash — the same image uploaded twice returns the same URL. Content at a given hash never changes, so cache invalidation is unnecessary.

## API

Full specification: [`openapi/v1/cdn-api.json`](../openapi/v1/cdn-api.json)

Authentication: mTLS (client certificate) + subscription key header (`Ocp-Apim-Subscription-Key`).

### POST /images

Upload an image. Returns a CDN URL and metadata document. Metadata extraction is async.

```plaintext
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

```plaintext
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

Delete image from storage, metadata, and CDN cache. Synchronous.

```plaintext
DELETE https://api.lekman.com/cdn/v1/images/LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564

204 No Content
```

| Status | Description |
|--------|-------------|
| 204 | Deleted and cache purged |
| 404 | Image does not exist |
| 502 | Cloudflare purge failed (storage already deleted) |

## Image Delivery

Images are served from Cloudflare CDN at `img.lekman.com/{hash}`:

```plaintext
https://img.lekman.com/LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564
```

- Cache-Control: `public, max-age=604800, immutable`
- WebP conversion and image optimisation enabled
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
| `ready` | Dimensions and EXIF extracted |
| `failed` | Extraction failed — image accessible via CDN, no dimensions/EXIF |

## Data Retention

All data expires after 7 days (Blob lifecycle policy, Cosmos DB TTL, Cloudflare max-age).

## Out of Scope

- Query or list operations (clients track their own hashes)
- Update operations (content-addressed, immutable)
- Image transformation at upload
- Long-term storage
- Access logging/analytics

## Further Reading

- [Architecture](ARCHITECTURE.md) — system design, C4 diagrams, component overview
- [Contributing](CONTRIBUTING.md) — dev setup, prerequisites, commands, PR process
- [Security](SECURITY.md) — vulnerability reporting, threat model
- [Requirements](requirements/EPIC.md) — product requirements

## License

[MIT](../LICENSE)
