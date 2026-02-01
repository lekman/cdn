# Architecture

**Audience**: Developers and contributors working on @lekman/cdn.

## System Context (C4 Level 1)

The system context shows how the Edge Cache CDN API fits into a consumer's workflow. Clients upload images via APIM. Images are served from Cloudflare CDN at the edge.

<div style="background: white; background-color: white; padding: 0px; border: 1px solid #ccc; border-radius: 10px; max-width: 700px; margin: 1em auto">

```mermaid
%%{init: {'theme':'neutral', 'themeVariables': { 'primaryColor':'#e3f2fd', 'primaryTextColor':'#000', 'primaryBorderColor':'#1976d2', 'lineColor':'#616161', 'secondaryColor':'#fff3e0', 'tertiaryColor':'#f3e5f5', 'fontSize':'14px'}}}%%
C4Context
    title Edge Cache CDN API - System Context
    
    Person(browser, "End User", "Views images via CDN URL")

    Person(client, "API Client", "Uploads/manages images via mTLS + subscription key")

    System(cdn, "Cloudflare CDN", "Edge cache and image optimisation at img.lekman.com")

    System(api, "CDN API", "APIM gateway: upload, metadata, delete")

    System_Ext(azure, "Azure Backend", "Blob Storage, Cosmos DB, Functions, Service Bus")

    Rel(client, api, "POST/GET/DELETE /images", "HTTPS + mTLS")
    Rel(browser, cdn, "GET img.lekman.com/{hash}", "HTTPS")
    Rel(api, azure, "Store, query, delete")
    Rel(cdn, azure, "Origin pull", "Blob Storage")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="1")
```

</div>

## Container Diagram (C4 Level 2)

Zooms into the system boundary to show each deployable unit and how they communicate. APIM handles all three API operations through XML policies with direct backend calls (no application code). Azure Functions handle the two async/complex operations: delete (which requires three coordinated deletes plus a Cloudflare purge) and metadata extraction (triggered by Service Bus).

<div style="background: white; background-color: white; padding: 0px; border: 1px solid #ccc; border-radius: 10px;">

<!-- [MermaidChart: c7dc0071-0ea9-4f28-847e-f4f29a34617d] -->
```mermaid
---
id: c7dc0071-0ea9-4f28-847e-f4f29a34617d
---
%%{init: {'theme':'neutral', 'themeVariables': { 'primaryColor':'#e3f2fd', 'primaryTextColor':'#000', 'primaryBorderColor':'#1976d2', 'lineColor':'#616161', 'secondaryColor':'#fff3e0', 'tertiaryColor':'#f3e5f5', 'fontSize':'14px'}}}%%
C4Container
    title Edge Cache CDN API - Container Diagram
    
    Person(browser, "End User")
    Person(client, "API Client")    

    Container_Boundary(cf, "Cloudflare") {
        Container(cdn, "Cloudflare CDN", "Edge", "img.lekman.com cache + optimisation")
    
    }

    Container_Boundary(apim, "Azure APIM") {
        Container(post, "POST /images", "APIM Policy", "Validate, hash, store blob, create Cosmos doc, queue message")
        Container(get, "GET /images/{hash}", "APIM Policy", "Query Cosmos DB by hash")
        Container(del, "DELETE /images/{hash}", "APIM Policy", "Route to Delete Function")
    }    

    Container_Boundary(data-storage, "Data Storage") {
        ContainerDb(cosmos, "Cosmos DB", "Azure", "Image metadata documents")
        ContainerDb(blob, "Blob Storage", "Azure", "Images stored by SHA-256 hash")
    }

    Container_Boundary(functions, "Azure Functions") {
        Container(delete_fn, "Delete Function", "HTTP Trigger", "Delete blob + Cosmos, purge Cloudflare")
        Container(metadata_fn, "Metadata Function", "Service Bus Trigger", "Extract dimensions + EXIF")
    }   

    Container_Boundary(events, "Event Management") {
        Container(bus, "Service Bus", "Azure", "image-metadata-extraction queue")
        Container(kv, "Key Vault", "Azure", "Cloudflare API token")
    }    

    Rel(client, post, "Upload image")
    Rel(client, get, "Get metadata")
    Rel(client, del, "Delete image")
    Rel(browser, cdn, "View image")

    Rel(post, blob, "Write blob")
    Rel(post, cosmos, "Create document")
    Rel(post, bus, "Queue message")

    Rel(get, cosmos, "Read document")

    Rel(del, delete_fn, "HTTP call")
    Rel(delete_fn, blob, "Delete blob")
    Rel(delete_fn, cosmos, "Delete document")
    Rel(delete_fn, cdn, "Purge cache")
    Rel(delete_fn, kv, "Read API token")

    Rel(bus, metadata_fn, "Trigger")
    Rel(metadata_fn, blob, "Read blob")
    Rel(metadata_fn, cosmos, "Update document")

    Rel(cdn, blob, "Origin pull")

    UpdateLayoutConfig($c4ShapeInRow="100", $c4BoundaryInRow="3")
```

</div>

## Component Overview

Each Azure resource serves a single purpose. APIM is the only public-facing component; all backend services use managed identity for authentication and have no public endpoints.

| Component | Technology | Purpose |
|-----------|------------|---------|
| Azure APIM | API Management policies (XML) | Gateway: auth, validation, hash computation, direct backend calls |
| Azure Blob Storage | Hot tier, LRS, 7-day lifecycle | Immutable image store, keyed by SHA-256 hash |
| Azure Cosmos DB | NoSQL, serverless, 7-day TTL | Metadata store: dimensions, EXIF, status |
| Azure Service Bus | Basic tier, single queue | Async trigger for metadata extraction |
| Azure Functions | Consumption plan, TypeScript | Delete+purge (HTTP trigger), metadata extraction (Service Bus trigger) |
| Cloudflare CDN | img.lekman.com | Edge cache with Polish and WebP conversion |
| Azure Key Vault | Secrets | Cloudflare API token storage |

## Data Flow

Step-by-step sequences for each operation. Upload and retrieval are handled entirely by APIM policies (no application code). Delete and metadata extraction run as Azure Functions.

### Upload Flow (POST /images)

The upload is handled entirely by APIM policy XML — no application code. The policy validates input, computes a content hash, checks for duplicates, then writes to three backend services in sequence.

<div style="background: white; background-color: white; padding: 0px; border: 1px solid #ccc; border-radius: 10px;">

```mermaid
%%{init: {'theme':'neutral', 'themeVariables': { 'primaryColor':'#e3f2fd', 'primaryTextColor':'#000', 'primaryBorderColor':'#1976d2', 'lineColor':'#616161', 'secondaryColor':'#fff3e0', 'tertiaryColor':'#f3e5f5', 'fontSize':'14px'}}}%%
sequenceDiagram
    autonumber
    actor Client
    participant APIM
    participant Cosmos as Cosmos DB
    participant Blob as Blob Storage
    participant Bus as Service Bus

    Client->>APIM: POST /images (binary body)
    APIM->>APIM: Validate Content-Type
    APIM->>APIM: SHA-256 hash → base64url (43 chars)
    APIM->>Cosmos: GET document by hash
    alt Document exists
        Cosmos-->>APIM: Existing document
        APIM-->>Client: 201 Created (existing)
    else New image
        Cosmos-->>APIM: 404
        APIM->>Blob: PUT /{hash} (image binary)
        Blob-->>APIM: 201
        APIM->>Cosmos: POST document (status: processing)
        Cosmos-->>APIM: 201
        APIM->>Bus: POST message (hash)
        Bus-->>APIM: 201
        APIM-->>Client: 201 Created (new document)
    end
```

</div>

### Retrieval Flow (GET /images/{hash})

A direct Cosmos DB lookup by partition key. No application code — APIM policy reads the document and returns it.

<div style="background: white; background-color: white; padding: 0px; border: 1px solid #ccc; border-radius: 10px;">

```mermaid
%%{init: {'theme':'neutral', 'themeVariables': { 'primaryColor':'#e3f2fd', 'primaryTextColor':'#000', 'primaryBorderColor':'#1976d2', 'lineColor':'#616161', 'secondaryColor':'#fff3e0', 'tertiaryColor':'#f3e5f5', 'fontSize':'14px'}}}%%
sequenceDiagram
    autonumber
    actor Client
    participant APIM
    participant Cosmos as Cosmos DB

    Client->>APIM: GET /images/{hash}
    APIM->>Cosmos: GET document by id (partition key = /id)
    alt Document found
        Cosmos-->>APIM: Document
        APIM-->>Client: 200 OK (metadata)
    else Not found
        Cosmos-->>APIM: 404
        APIM-->>Client: 404 Not Found
    end
```

</div>

### Delete Flow (DELETE /images/{hash})

APIM routes to the Delete Azure Function, which performs three coordinated deletes. Blob and Cosmos deletions are silent on 404. Cloudflare purge failure returns 502 (storage already deleted at that point).

<div style="background: white; background-color: white; padding: 0px; border: 1px solid #ccc; border-radius: 10px;">

```mermaid
%%{init: {'theme':'neutral', 'themeVariables': { 'primaryColor':'#e3f2fd', 'primaryTextColor':'#000', 'primaryBorderColor':'#1976d2', 'lineColor':'#616161', 'secondaryColor':'#fff3e0', 'tertiaryColor':'#f3e5f5', 'fontSize':'14px'}}}%%
sequenceDiagram
    autonumber
    actor Client
    participant APIM
    participant Fn as Delete Function
    participant Blob as Blob Storage
    participant Cosmos as Cosmos DB
    participant CF as Cloudflare CDN
    participant KV as Key Vault

    Client->>APIM: DELETE /images/{hash}
    APIM->>Fn: HTTP call
    Fn->>Blob: Delete /{hash}
    Blob-->>Fn: 204 (silent on 404)
    Fn->>Cosmos: Delete document
    Cosmos-->>Fn: 204 (silent on 404)
    Fn->>KV: Get Cloudflare API token
    KV-->>Fn: Token
    Fn->>CF: Purge img.lekman.com/{hash}
    alt Purge succeeds
        CF-->>Fn: 200
        Fn-->>APIM: 204
        APIM-->>Client: 204 No Content
    else Purge fails
        CF-->>Fn: Error
        Fn-->>APIM: 502
        APIM-->>Client: 502 Bad Gateway
    end
```

</div>

### Image Delivery Flow

End users fetch images directly from Cloudflare CDN. On cache miss, Cloudflare pulls from Azure Blob Storage origin and caches the response for 7 days with `immutable` directive.

<div style="background: white; background-color: white; padding: 0px; border: 1px solid #ccc; border-radius: 10px;">

```mermaid
%%{init: {'theme':'neutral', 'themeVariables': { 'primaryColor':'#e3f2fd', 'primaryTextColor':'#000', 'primaryBorderColor':'#1976d2', 'lineColor':'#616161', 'secondaryColor':'#fff3e0', 'tertiaryColor':'#f3e5f5', 'fontSize':'14px'}}}%%
sequenceDiagram
    autonumber
    actor User as End User
    participant CF as Cloudflare CDN
    participant Blob as Blob Storage

    User->>CF: GET img.lekman.com/{hash}
    alt Cache hit
        CF-->>User: 200 (image, < 50ms P95)
    else Cache miss
        CF->>Blob: Origin pull /{hash}
        Blob-->>CF: 200 (image binary)
        CF->>CF: Cache (max-age=604800, immutable)
        CF-->>User: 200 (image)
    end
```

</div>

### Metadata Extraction Flow (Async)

Triggered by Service Bus after upload. The function reads the image from Blob Storage, extracts dimensions and EXIF data, then updates the Cosmos document. Failures are recorded but not retried.

<div style="background: white; background-color: white; padding: 0px; border: 1px solid #ccc; border-radius: 10px;">

```mermaid
%%{init: {'theme':'neutral', 'themeVariables': { 'primaryColor':'#e3f2fd', 'primaryTextColor':'#000', 'primaryBorderColor':'#1976d2', 'lineColor':'#616161', 'secondaryColor':'#fff3e0', 'tertiaryColor':'#f3e5f5', 'fontSize':'14px'}}}%%
sequenceDiagram
    autonumber
    participant Bus as Service Bus
    participant Fn as Metadata Function
    participant Blob as Blob Storage
    participant Cosmos as Cosmos DB

    Bus->>Fn: Message (hash)
    Fn->>Blob: Read /{hash}
    Blob-->>Fn: Image binary
    Fn->>Fn: Extract width, height
    Fn->>Fn: Extract EXIF (date, GPS, camera)
    alt Extraction succeeds
        Fn->>Cosmos: Update (status: ready, + metadata)
        Cosmos-->>Fn: 200
    else Extraction fails
        Fn->>Cosmos: Update (status: failed)
        Cosmos-->>Fn: 200
    end
```

</div>

## Hash Specification

| Property | Value |
|----------|-------|
| Algorithm | SHA-256 |
| Encoding | Base64url (RFC 4648), no padding |
| Length | 43 characters |
| Example | `LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564` |

Content-addressing provides automatic deduplication — uploading the same image twice returns the existing document. Cache invalidation is unnecessary because content at a given hash never changes.

## Cosmos DB Document Schema

Each image gets one document, partitioned by `/id` (the hash). The `status` field tracks metadata extraction progress. The `ttl` field (604800 seconds = 7 days) triggers automatic deletion by Cosmos DB.

```json
{
  "id": "{hash}",
  "url": "https://img.lekman.com/{hash}",
  "status": "processing|ready|failed",
  "size": 245678,
  "contentType": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "exif": {
    "created": "2025-01-15T14:30:00Z",
    "location": { "lat": 51.5074, "lon": -0.1278 },
    "camera": "iPhone 15 Pro"
  },
  "createdAt": "2026-01-31T10:00:00Z",
  "ttl": 604800
}
```

## Technology Stack

Tools and frameworks used for development and CI/CD. See [Contributing](CONTRIBUTING.md) for setup instructions.

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Bun | TypeScript runtime for Azure Functions |
| Language | TypeScript (strict) | Type-safe source code |
| IaC | Bicep | Azure resource provisioning |
| Linting | Biome | Formatting and lint rules |
| Testing | Bun test runner | Unit tests with coverage |
| Pre-commit | Husky | Runs lint and typecheck before commit |
| Security | Semgrep | Static analysis in CI |
| CI/CD | GitHub Actions | Build, test pipeline |
| Versioning | release-please | Automated releases from conventional commits |
