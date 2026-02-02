---
version: 0.1.0
status: approved
ticket: none
---

# Product Requirements Document: Swagger UI on GitHub Pages

## Background

### Problem Statement

The OpenAPI specification (`openapi/v1/cdn-api.json`) is only readable as raw JSON in the repository. API consumers (internal developers, integration partners) need an interactive, browsable API reference without running a local tool or importing the spec into a third-party service. A hosted Swagger UI would let consumers explore endpoints, view request/response schemas, and understand the API without leaving their browser.

### User Personas

- **Integration partner** — needs to understand the API contract (endpoints, schemas, auth requirements) before writing client code. Currently reads raw JSON or copies the spec into a local Swagger editor.
- **Internal developer** — needs a reference while building APIM policies or function handlers. Currently cross-references the JSON spec with the EPIC document.

### Vision Statement

Provide a zero-maintenance, automatically deployed interactive API reference at `https://lekman.github.io/cdn/` that stays in sync with the OpenAPI spec on every push to `main`.

### System Context & Stakeholders

This feature is a read-only documentation site. It has no runtime dependencies on the CDN API infrastructure. GitHub Pages serves static files from the repository. Swagger UI assets are loaded from unpkg CDN at runtime.

```
GitHub Pages (https://lekman.github.io/cdn/)
  +-- index.html
       +-- Loads Swagger UI JS/CSS from unpkg CDN
       +-- Fetches openapi/v1/cdn-api.json (relative path)
            +-- Renders interactive API docs
```

Stakeholders: API consumers, project maintainers.

## Objectives

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| unpkg CDN downtime prevents Swagger UI from loading | Pin to major version (`@5`); can vendor assets later if needed |
| Relative path breaks if GitHub Pages base path changes | Use explicit relative prefix `./openapi/v1/cdn-api.json` |
| Jekyll processing interferes with file serving | `.nojekyll` marker file bypasses Jekyll |
| OpenAPI spec updates not visible | GitHub Actions deploys on every push that touches `openapi/**` |

## Core Features (Must Have)

### Feature 1: Swagger UI Static Page

**Description:** A single `index.html` in the repository root that loads Swagger UI from unpkg CDN and renders the OpenAPI spec at `openapi/v1/cdn-api.json` using a relative URL. Includes a `.nojekyll` marker file to bypass Jekyll processing on GitHub Pages.

**Acceptance Criteria:**

- AC1: Given the repository root, when `index.html` is opened in a browser, then Swagger UI renders without console errors
- AC2: Given Swagger UI has loaded, when the page finishes rendering, then all 3 API operations (POST /images, GET /images/{hash}, DELETE /images/{hash}) are visible
- AC3: Given the `index.html` file, when inspecting the source, then Swagger UI CSS and JS are loaded from `unpkg.com/swagger-ui-dist@5`
- AC4: Given the `index.html` file, when inspecting the SwaggerUIBundle config, then the `url` parameter is set to `./openapi/v1/cdn-api.json`
- AC5: Given the repository root, when listing files, then `.nojekyll` exists as an empty file

### Feature 2: GitHub Pages Deployment in CD Workflow

**Description:** Add a GitHub Pages deployment job to the existing `cd.yml` workflow. The job triggers when files under `openapi/**` or the `index.html` change on the `main` branch. Uses the `actions/deploy-pages` action for deployment. The job verifies deployment succeeded by checking the GitHub Pages URL returns HTTP 200.

**Acceptance Criteria:**

- AC1: Given a push to `main` that modifies files under `openapi/**`, when the CD workflow runs, then the `deploy-pages` job executes
- AC2: Given a push to `main` that modifies `index.html`, when the CD workflow runs, then the `deploy-pages` job executes
- AC3: Given a push to `main` that does not modify `openapi/**` or `index.html`, when the CD workflow runs, then the `deploy-pages` job is skipped
- AC4: Given the `deploy-pages` job completes, when checking `https://lekman.github.io/cdn/`, then the page returns HTTP 200
- AC5: Given the deployment job, when inspecting the workflow, then it uses `actions/upload-pages-artifact` and `actions/deploy-pages`

## Architecture & Design

This feature has no business logic, no TypeScript code, and no domain model. It consists of:

1. A static HTML file (`index.html`) that loads third-party JS/CSS at runtime
2. A marker file (`.nojekyll`) that configures GitHub Pages behavior
3. A GitHub Actions workflow job that deploys static files

No Clean Architecture layers, interfaces, or dependency injection apply.

### External Dependencies

| Dependency | Purpose | Risk |
|-----------|---------|------|
| unpkg CDN | Serves Swagger UI JS/CSS (`swagger-ui-dist@5`) | CDN downtime; mitigated by major version pin |
| GitHub Pages | Hosts the static site | GitHub infrastructure SLA |
| `actions/deploy-pages` | Deploys to GitHub Pages | GitHub Actions official action |

## Test Strategy

This feature is classified as **Low risk** — it is read-only documentation with no business logic, no data processing, and no security surface. If broken, API consumers fall back to reading the raw JSON spec.

### Risk Classification

| Risk level | Impact if broken | Required test levels |
|-----------|-----------------|---------------------|
| **Low** | Documentation unavailable, workaround exists (raw JSON) | Deployment verification |

### Test Approach

No unit tests apply — there is no TypeScript code or business logic.

Testing is handled by:

1. **CD workflow verification** — The GitHub Pages deployment job in `cd.yml` confirms the deployment completes without errors
2. **HTTP smoke check** — After deployment, the workflow verifies `https://lekman.github.io/cdn/` returns HTTP 200
3. **Manual access test** — After the first deployment, a maintainer opens the URL in a browser and confirms all 3 operations render

### Acceptance Criteria (Testable)

| ID | Criterion | Test Level | Automated |
|----|-----------|-----------|-----------|
| AC1 | Swagger UI loads without console errors | Manual | No |
| AC2 | All 3 operations visible | Manual | No |
| AC3 | Deployment job succeeds in CD workflow | CD workflow | Yes |
| AC4 | GitHub Pages URL returns HTTP 200 | CD workflow smoke check | Yes |

## Security Considerations

| Threat | Risk Level | Mitigation |
|--------|-----------|------------|
| XSS via Swagger UI | Low | Swagger UI is loaded from unpkg CDN (trusted source), pinned to major version |
| Spec exposes internal details | Low | The OpenAPI spec is already public in the repository |
| "Try it out" exposes credentials | N/A | mTLS + subscription key auth prevents browser-based API calls; noted in Out of Scope |

## Future Enhancements

- Custom domain for the docs site (e.g., `docs.lekman.com/cdn`)
- Multiple API version support when v2 is introduced
- Custom Swagger UI theme or branding
- Automated Swagger UI version updates via Dependabot or Renovate
- "Try it out" support via a dev environment with relaxed auth
