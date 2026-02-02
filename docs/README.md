# Edge Cache CDN API

Content-addressed image storage and distribution using Cloudflare CDN with Azure backend.

## Overview

`@lekman/cdn` is a temporary image hosting API. Clients upload images via a REST API, receive a content-addressed CDN URL (`img.lekman.com/{sha256}`), and images auto-expire after 7 days. Metadata (dimensions, EXIF) is extracted asynchronously after upload.

Images are stored by SHA-256 hash — the same image uploaded twice returns the same URL. Content at a given hash never changes, so cache invalidation is unnecessary.

## API

[![Edge Cache CDN API v1.0.0](https://badges.ws/badge/Edge_Cache_CDN_API-v1.0.0-green?logo=openapiinitiative)](https://lekman.github.io/cdn/)

Authentication: mTLS (client certificate) + subscription key header (`Ocp-Apim-Subscription-Key`).

Endpoints: `POST /images`, `GET /images/{hash}`, `DELETE /images/{hash}`. See the [interactive API docs](https://lekman.github.io/cdn/) for request/response schemas, status codes, and examples.

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
