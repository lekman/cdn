# PRD: Infrastructure Provisioning

**Version:** 1.0
**Author:** Claude Code
**Date:** 31 January 2026
**Status:** Draft
**Epic Reference:** EPIC.md — Epic 1 (Stories 1.1, 1.2, 1.3)
**Priority:** P0 (Prerequisite for PRDs 3–6)

---

## Background

### Problem Statement

The Edge Cache CDN API requires Azure infrastructure (Blob Storage, Cosmos DB, Service Bus, Functions, Key Vault) and external service configuration (Cloudflare CDN, APIM) before any application code can be deployed. All infrastructure must be provisioned declaratively via Bicep for reproducibility and CI/CD integration.

### System Context

This PRD covers the outermost layer of the clean architecture — the **Frameworks & Drivers** layer — specifically the infrastructure definitions that enable all other components.

```
┌─────────────────────────────────────────────┐
│  Infrastructure (Bicep, Cloudflare, APIM)   │  ← This PRD
├─────────────────────────────────────────────┤
│  Frameworks & Drivers (Azure SDK, HTTP)     │  ← PRDs 5–6
├─────────────────────────────────────────────┤
│  Interface Adapters / Business Rules        │  ← PRDs 1, 3–6
└─────────────────────────────────────────────┘
```

### Dependencies

- **Depends on:** Nothing (can be developed in parallel with PRD 1)
- **Depended on by:** PRD 3 (Upload Pipeline), PRD 4 (Metadata Retrieval), PRD 5 (Delete Pipeline), PRD 6 (Metadata Extraction)

---

## Objectives

### SMART Goals

- **Specific:** Provision all Azure resources and configure Cloudflare CDN and APIM gateway
- **Measurable:** All resources deployable via single `az deployment` command; zero manual steps
- **Achievable:** Standard Azure Bicep modules with parameterised configuration
- **Relevant:** Required before any function deployment or API testing
- **Time-bound:** Must be completed before PRDs 3–6 can deploy

### Key Performance Indicators

| KPI | Target |
|-----|--------|
| Resources provisioned | 7 Azure resources + Cloudflare zone |
| Manual configuration steps | Zero (fully declarative) |
| Deployment idempotency | Re-run produces no changes when state is clean |
| Security findings | Zero hardcoded credentials in Bicep |

---

## Features

### Feature 1: Azure Resource Provisioning (Story 1.1)

Bicep templates for all Azure resources required by the CDN API.

### Feature 2: APIM Configuration (Story 1.2)

API Management gateway definition with operations, authentication, and rate limiting.

### Feature 3: Cloudflare Configuration (Story 1.3)

CDN zone configuration, origin setup, cache rules, and API token provisioning.

---

## Work Breakdown Structure

### WBS 1: Blob Storage Module (`infra/modules/storage.bicep`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 1.1 | Define Storage Account resource | Standard_LRS, Hot tier, Kind: StorageV2 |
| 1.2 | Define Blob Container `images` | Public access level: Blob (anonymous read for blobs) |
| 1.3 | Configure lifecycle management policy | Delete blobs older than 7 days |
| 1.4 | Output storage account name and endpoint | Outputs available for other modules |

**Acceptance Criteria (EPIC AC):**
- AC1: Storage account created with blob container, public access enabled, 7-day lifecycle policy

---

### WBS 2: Cosmos DB Module (`infra/modules/cosmosdb.bicep`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 2.1 | Define Cosmos DB Account resource | API: NoSQL, Capacity: Serverless |
| 2.2 | Define Database `cdn` | Throughput: Serverless (no provisioned RU/s) |
| 2.3 | Define Container `images` | Partition key: `/id`, TTL enabled (default off, per-document) |
| 2.4 | Output connection details | Account endpoint and database/container names |

**Acceptance Criteria (EPIC AC):**
- AC2: Cosmos DB account created (serverless), database and container with `/id` partition key, TTL enabled

---

### WBS 3: Service Bus Module (`infra/modules/servicebus.bicep`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 3.1 | Define Service Bus Namespace | Tier: Basic |
| 3.2 | Define Queue `image-metadata-extraction` | Message TTL: 1 hour, Max delivery count: 1 (no retry) |
| 3.3 | Output namespace connection details | Namespace name and queue name |

**Acceptance Criteria (EPIC AC):**
- AC3: Service Bus namespace and queue (`image-metadata-extraction`) created

---

### WBS 4: Function App Module (`infra/modules/functions.bicep`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 4.1 | Define App Service Plan | Consumption plan (Y1) |
| 4.2 | Define Function App resource | Runtime: Node.js (Bun-compatible), OS: Linux |
| 4.3 | Enable System-Assigned Managed Identity | Identity type: SystemAssigned |
| 4.4 | Configure app settings | Storage connection, Cosmos endpoint, Service Bus connection, Key Vault URI |
| 4.5 | Assign RBAC roles | Storage Blob Data Contributor, Cosmos DB Data Contributor, Service Bus Data Receiver, Key Vault Secrets User |
| 4.6 | Output function app name and principal ID | For downstream RBAC and APIM backend config |

**Acceptance Criteria (EPIC AC):**
- AC4: Function App created with managed identity, connected to storage/Cosmos/Service Bus

---

### WBS 5: Key Vault Module (`infra/modules/keyvault.bicep`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 5.1 | Define Key Vault resource | Standard tier, soft delete enabled |
| 5.2 | Define access policy for Function App | Secret Get permission for Function App managed identity |
| 5.3 | Define secret placeholder for Cloudflare API token | Secret name: `cloudflare-api-token` (value set manually or via CI) |
| 5.4 | Output Key Vault URI | For Function App configuration |

---

### WBS 6: Main Deployment Template (`infra/main.bicep`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 6.1 | Define parameters | `environment` (dev/staging/prod), `location`, `projectName` |
| 6.2 | Compose all modules | Reference storage, cosmosdb, servicebus, functions, keyvault modules |
| 6.3 | Wire inter-module dependencies | Function App receives connection strings from other modules |
| 6.4 | Define deployment outputs | All resource names and endpoints |

**Acceptance Criteria (EPIC AC):**
- AC5: All resources deployed via CI/CD pipeline

---

### WBS 7: APIM Configuration (`infra/modules/apim.bicep`)

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 7.1 | Define API at `/cdn/v1` | Three operations: POST /images, GET /images/{hash}, DELETE /images/{hash} |
| 7.2 | Configure mTLS client certificate validation | Certificate thumbprint validation in inbound policy |
| 7.3 | Enable subscription key validation | Header: `Ocp-Apim-Subscription-Key` |
| 7.4 | Configure rate limiting policy | Rate limit per subscription key |
| 7.5 | Enforce request size limit | Maximum 25MB request body for POST |
| 7.6 | Configure backend for Delete Function | Backend URL pointing to Function App |

**Acceptance Criteria (EPIC AC — Story 1.2):**
- AC1: API defined at `/cdn/v1` with three operations
- AC2: mTLS configured with client certificate validation
- AC3: Subscription key validation enabled
- AC4: Rate limiting policy applied
- AC5: Request size limit (25MB) enforced

---

### WBS 8: Cloudflare Configuration (Documentation)

> Note: Cloudflare configuration is external (not Bicep-managed). This WBS produces a runbook document.

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 8.1 | Document DNS record configuration | A/CNAME record for `img.lekman.com` proxied through Cloudflare |
| 8.2 | Document origin configuration | Origin: `{storage-account}.blob.core.windows.net` |
| 8.3 | Document cache rules | `Cache-Control: public, max-age=604800, immutable` |
| 8.4 | Document Polish and WebP settings | Polish: Lossy, WebP: On |
| 8.5 | Document API token creation | Permissions: Zone.Cache Purge, stored in Key Vault |

**Acceptance Criteria (EPIC AC — Story 1.3):**
- AC1: DNS record for img.lekman.com pointing to Cloudflare
- AC2: Origin configured to Azure Blob Storage endpoint
- AC3: Cache rules set: `Cache-Control: public, max-age=604800, immutable`
- AC4: Polish enabled
- AC5: WebP conversion enabled
- AC6: API token created for purge operations, stored in Key Vault

---

### WBS 9: CI/CD Deployment Pipeline

| Task | Description | Acceptance Criteria |
|------|-------------|-------------------|
| 9.1 | Create deployment workflow | GitHub Actions workflow: `deploy-infra.yml` |
| 9.2 | Configure Azure login | Federated identity (OIDC) with GitHub Actions |
| 9.3 | Add Bicep validation step | `az bicep build` for syntax validation |
| 9.4 | Add what-if step | Preview changes before deployment |
| 9.5 | Add deployment step | `az deployment group create` with parameter files |
| 9.6 | Add environment-specific parameter files | `infra/params/dev.bicepparam`, `infra/params/prod.bicepparam` |

---

## File Summary

| File | Purpose |
|------|---------|
| `infra/main.bicep` | Main deployment composition |
| `infra/modules/storage.bicep` | Blob Storage account + container |
| `infra/modules/cosmosdb.bicep` | Cosmos DB account, database, container |
| `infra/modules/servicebus.bicep` | Service Bus namespace + queue |
| `infra/modules/functions.bicep` | Function App + managed identity + RBAC |
| `infra/modules/keyvault.bicep` | Key Vault for Cloudflare token |
| `infra/modules/apim.bicep` | API Management configuration |
| `infra/params/dev.bicepparam` | Development environment parameters |
| `infra/params/prod.bicepparam` | Production environment parameters |
| `.github/workflows/deploy-infra.yml` | Infrastructure deployment pipeline |
| `docs/runbooks/cloudflare-setup.md` | Cloudflare manual configuration guide |

---

## Milestones

| Phase | Deliverables | Dependencies |
|-------|-------------|-------------|
| Phase 1 | Individual Bicep modules (storage, cosmos, servicebus, keyvault) | None |
| Phase 2 | Function App module with RBAC assignments | Phase 1 (needs resource references) |
| Phase 3 | APIM configuration module | Phase 2 (needs Function App backend URL) |
| Phase 4 | Main template composition + parameter files | Phases 1–3 |
| Phase 5 | CI/CD deployment workflow | Phase 4 |
| Phase 6 | Cloudflare runbook documentation | Independent |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Bicep deployment fails in CI | Add `what-if` preview step; use validation before deployment |
| Managed identity RBAC propagation delay | RBAC assignments complete before Function App starts; add retry logic in deployment |
| Cloudflare manual steps cause drift | Document all steps in runbook; consider Terraform Cloudflare provider in future |
| Secrets leak in Bicep parameters | Use Key Vault references; never pass secrets as plain-text parameters |
