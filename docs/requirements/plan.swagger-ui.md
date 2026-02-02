# Implementation Plan: Swagger UI on GitHub Pages

## Prerequisites

- **Exists:** OpenAPI spec at `openapi/v1/cdn-api.json` (536-line JSON, 3 operations)
- **Exists:** CD workflow at `.github/workflows/cd.yml` (Azure/Pulumi deployment)
- **Needs creation:** `index.html` in repository root
- **Needs creation:** `.nojekyll` in repository root
- **Needs modification:** `cd.yml` to add GitHub Pages deployment job

## Phase 1: Static Swagger UI Page

No dependencies on other phases. Can be implemented independently.

### Task 1.1: Create `index.html`

- **File:** `index.html` (repository root)
- **Purpose:** Load Swagger UI from unpkg CDN and render OpenAPI spec
- **Details:**
  - HTML5 document with charset and viewport meta tags
  - Load `swagger-ui-dist@5` CSS from `unpkg.com`
  - Load `swagger-ui-dist@5/swagger-ui-bundle.js` from `unpkg.com`
  - Load `swagger-ui-dist@5/swagger-ui-standalone-preset.js` from `unpkg.com`
  - Initialize `SwaggerUIBundle` with `url: "./openapi/v1/cdn-api.json"`
  - Use `SwaggerUIStandalonePreset` for standalone layout
  - Set page title to "Edge Cache CDN API"
- **Acceptance:** AC1, AC2, AC3, AC4

### Task 1.2: Create `.nojekyll`

- **File:** `.nojekyll` (repository root)
- **Purpose:** Bypass Jekyll processing on GitHub Pages
- **Details:** Empty file, no content
- **Acceptance:** AC5

## Phase 2: GitHub Pages Deployment Workflow

Depends on Phase 1 files existing but can be developed in parallel.

### Task 2.1: Update `cd.yml` with path triggers

- **File:** `.github/workflows/cd.yml`
- **Change:** Add `openapi/**` and `index.html` to the `on.push.paths` trigger
- **Details:**
  - Existing paths: `infra/**`, `.github/workflows/cd.yml`
  - Add: `openapi/**`, `index.html`
  - This ensures the workflow runs when the spec or the UI page changes

### Task 2.2: Add `deploy-pages` job to `cd.yml`

- **File:** `.github/workflows/cd.yml`
- **Change:** Add a new `deploy-docs` job
- **Details:**
  - Uses `actions/upload-pages-artifact@v3` to upload `index.html`, `.nojekyll`, and `openapi/` directory
  - Uses `actions/deploy-pages@v4` to deploy to GitHub Pages
  - Uses `actions/configure-pages@v5` to set up Pages
  - Job-level permissions: `pages: write`, `id-token: write`
  - Runs independently of the `deploy` job (no `needs` dependency)
  - Only runs when `openapi/**`, `index.html`, or `.nojekyll` change
  - Includes HTTP 200 smoke check against `https://lekman.github.io/cdn/`

### Task 2.3: Update workflow-level permissions

- **File:** `.github/workflows/cd.yml`
- **Change:** Ensure workflow-level permissions include `pages: write` or add it at job level
- **Details:** Follow AGENTS.md rule: elevate permissions only at job level

## Dependency Graph

```
Phase 1 (Static Files)         Phase 2 (Workflow)
├── Task 1.1: index.html       ├── Task 2.1: path triggers
├── Task 1.2: .nojekyll        ├── Task 2.2: deploy-pages job
                                └── Task 2.3: permissions
```

Phases 1 and 2 are independent and can be implemented in parallel.

## File Summary

| File | Layer | Action | Coverage |
|------|-------|--------|----------|
| `index.html` | Static asset | Create | N/A (HTML) |
| `.nojekyll` | Config marker | Create | N/A (empty) |
| `.github/workflows/cd.yml` | CI/CD | Modify | N/A (YAML) |

## Test Strategy

Per PRD: **Low risk** — no unit tests required. Verification via:

1. CD workflow deployment job succeeds
2. HTTP 200 smoke check in workflow
3. Manual browser verification after first deployment

## Security Review

- No secrets in static HTML
- No `console.log` in production code (no JS code authored)
- Swagger UI loaded from trusted CDN (unpkg.com), pinned to major version `@5`
- No credentials exposed — mTLS + subscription key auth prevents "Try it out" usage
