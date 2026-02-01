---
version: 2.0.0
status: approved
ticket: infrastructure
---

# PRD: Infrastructure Provisioning (Pulumi)

**Epic Reference:** EPIC.md — Epic 1 (Stories 1.1, 1.2, 1.3)
**Priority:** P0 (Prerequisite for PRDs 3–6)

## Problem Statement

The Edge Cache CDN API requires Azure infrastructure (Blob Storage, Cosmos DB, Function App, Key Vault) and APIM API registration before any application code can be deployed. The APIM instance and Service Bus namespace already exist in a separate Pulumi stack (`rag-infra`). CDN infrastructure must be provisioned as a separate Pulumi stack that references the existing stack for shared resources. All infrastructure must follow the same Pulumi TypeScript patterns established in the `rag` project: config separation (pure functions testable without Pulumi runtime), spec-driven parameterization, and managed identity.

## Vision Statement

CDN-specific Azure resources are defined in a Pulumi TypeScript stack (`cdn-infra`) that references the existing `rag-infra` stack for APIM and Service Bus. Pure config functions enable testing with Bun without Pulumi runtime. Deployment is idempotent via `pulumi up` with per-environment stack configs.

## User Personas

### Platform Engineer
- Deploys and maintains Azure infrastructure across dev/prod environments
- Needs idempotent Pulumi stacks that can be reviewed in PRs
- Expects `task infra:up` to deploy all resources

### Application Developer
- Depends on provisioned infrastructure to deploy and test Azure Functions
- Needs connection strings, endpoints, and managed identity RBAC configured automatically
- Cannot deploy PRDs 3–6 until infrastructure exists

### DevOps/CI Pipeline
- Automated pipeline that runs `pulumi preview` and `pulumi up`
- Requires OIDC-based Azure authentication (no stored secrets)
- Uses stack references to connect to existing APIM

## Core Features

### Must Have

#### Feature 1: Pulumi Project Scaffold
Pulumi TypeScript project following rag project conventions:
- `infra/` directory with `Pulumi.yaml`, `package.json`, `tsconfig.json`
- `stack.ts` environment bridge (validates dev/prod stack names)
- `specification.ts` with environment-specific resource config
- `index.ts` entrypoint exporting stack outputs
- `Pulumi.dev.yaml` and `Pulumi.prod.yaml` stack configs

#### Feature 2: Resource Group and Stack Reference
CDN resources are deployed into their own resource group (`cdn-{env}-rg`), separate from the rag-infra resource group. The `rag-infra` stack reference is used only for shared resources:
- APIM service name (register CDN API operations)
- Service Bus namespace name (create CDN queue)
- RAG resource group name (for APIM/Service Bus operations only)

#### Feature 3: CDN Azure Resources (Story 1.1)
Pulumi resources for CDN-specific infrastructure:
- Storage Account (Standard_LRS, Hot, StorageV2) with `images` container (public blob access, 7-day lifecycle)
- Cosmos DB Account (NoSQL, Serverless) with `cdn` database and `images` container (`/id` partition key, TTL enabled)
- Key Vault (Standard, soft delete) with Cloudflare API token secret placeholder
- Function App (Consumption Y1, Linux, Node.js, SystemAssigned managed identity)
- RBAC: Storage Blob Data Contributor, Cosmos DB Data Contributor, Service Bus Data Receiver, Key Vault Secrets User

#### Feature 4: Service Bus Queue
Create `image-metadata-extraction` queue on the existing Service Bus namespace (from rag-infra stack reference):
- Message TTL: 1 hour
- Max delivery count: 1 (no retry)

#### Feature 5: CDN API in APIM (Story 1.2)
Register CDN API and operations in the existing APIM instance (from rag-infra stack reference):
- API at `/cdn/v1` importing OpenAPI spec from `openapi/v1/cdn-api.json`
- Operation policies loaded from `policies/post-images.xml` and `policies/get-image.xml`
- Named values for backend endpoints (cosmos-endpoint, blob-endpoint, servicebus-endpoint)
- APIM managed identity RBAC: Storage Blob Data Contributor, Cosmos DB Data Contributor, Service Bus Data Sender

#### Feature 6: Taskfile Integration
Add `infra:*` tasks to Taskfile.yml matching rag project conventions:
- `infra:init` — Initialize dev and prod stacks
- `infra:preview` — Preview changes
- `infra:up` — Deploy to Azure
- `infra:down` — Destroy resources
- `infra:outputs` — Show stack outputs

#### Feature 7: CrossGuard Security Policy Pack
MCSB-aligned security policies enforced at deployment time via Pulumi CrossGuard:
- Storage TLS 1.2+ and HTTPS transfer enforcement (DP-3)
- Key Vault soft delete requirement (DP-1)
- Function App managed identity requirement (IM-1)
- APIM HTTPS-only API protocols (NS-8)
- Resource tagging enforcement (PM-1)

### Nice to Have
- Cloudflare Terraform provider for automated DNS/cache configuration (future)

## Architecture & Design

### System Context

This PRD covers the Frameworks & Drivers layer — infrastructure definitions that enable all other components. It references the existing rag-infra stack for shared APIM and Service Bus resources.

```
rag-infra stack (already deployed)           cdn-infra stack (this PRD)
+-----------------------------------+        +-----------------------------------+
| Resource Group (rag-{env}-rg)     |  <---  | StackReference("rag-infra")       |
| APIM Instance                     |  <---  |   -> ragResourceGroupName         |
| Service Bus Namespace             |  <---  |   -> apimServiceName              |
| Log Analytics                     |        |   -> serviceBusNamespaceName      |
+-----------------------------------+        +-----------------------------------+
                                             | Resource Group (cdn-{env}-rg)     |
                                             |   Storage Account + Container     |
                                             |   Cosmos DB + Database + Container|
                                             |   Key Vault + Secret              |
                                             |   Function App + Identity + RBAC  |
                                             +-----------------------------------+
                                             | On RAG Resource Group:            |
                                             |   SB Queue (existing namespace)   |
                                             |   APIM API + Operations + Policies|
                                             |   APIM Named Values (endpoints)   |
                                             +-----------------------------------+
                                             | CrossGuard Policy Pack            |
                                             |   security/policy-pack/           |
                                             +-----------------------------------+
```

### Module Organization

```
infra/
  Pulumi.yaml              # Project config (runtime: nodejs)
  Pulumi.dev.yaml           # Dev stack config
  Pulumi.prod.yaml          # Prod stack config (secrets)
  package.json              # Dependencies (@pulumi/pulumi, @pulumi/azure-native, @pulumi/policy)
  tsconfig.json             # TypeScript strict mode
  index.ts                  # Stack entrypoint, exports outputs
  stack.ts                  # Environment bridge (validates dev/prod)
  specification.ts          # Environment-specific infrastructure specs
  cdn/
    configs.ts              # Pure config functions (no Pulumi imports, testable)
    resource-group.ts       # CDN resource group (cdn-{env}-rg)
    storage.ts              # Storage Account + Container + Lifecycle
    cosmosdb.ts             # Cosmos DB Account + Database + Container
    keyvault.ts             # Key Vault + Secret placeholder
    functions.ts            # Function App + App Service Plan + Identity
    role-assignments.ts     # RBAC for Function App and APIM managed identities
    service-bus-queue.ts    # Queue on existing SB namespace (RAG RG)
    api.ts                  # CDN API definition in existing APIM (RAG RG)
    policies.ts             # Operation policies (loads XML from policies/)
    named-values.ts         # APIM named values for backend endpoints (RAG RG)
  security/
    policy-pack/
      index.ts              # CrossGuard PolicyPack (cdn-security)
      policies.ts           # Pure policy definitions (MCSB-aligned)
```

### Dependencies

- **Depends on:** `rag-infra` stack (APIM, Resource Group, Service Bus)
- **Depended on by:** PRD 3 (Upload), PRD 4 (Metadata Retrieval), PRD 5 (Delete), PRD 6 (Extraction)

## Interface Boundaries

### Stack Reference Outputs (from rag-infra)

| Output | Type | Used for |
|--------|------|----------|
| resourceGroupName | string | APIM/Service Bus operations (RAG RG) |
| apimId | string | Register CDN API |
| serviceBusNamespaceName | string | Create CDN queue |

### CDN Stack Outputs

| Output | Type | Used by |
|--------|------|---------|
| resourceGroupName | string | CDN resource group name |
| storageAccountName | string | Function App config |
| blobEndpoint | string | APIM named value, Cloudflare origin |
| cosmosAccountEndpoint | string | APIM named value, Function App config |
| keyVaultUri | string | Function App config |
| functionAppName | string | APIM backend |
| serviceBusQueueName | string | Function App trigger |

### Environment Parameters (specification.ts)

| Parameter | Type | Dev | Prod |
|-----------|------|-----|------|
| location | string | uksouth | uksouth |
| storageAccountName | string | cdn-dev-sa | cdn-prod-sa |
| cosmosAccountName | string | cdn-dev-cosmos | cdn-prod-cosmos |
| functionAppName | string | cdn-dev-func | cdn-prod-func |
| keyVaultName | string | cdn-dev-kv | cdn-prod-kv |

## Domain Model

### Azure Resources

| Resource | File | Key Properties |
|----------|------|---------------|
| Storage Account | `cdn/storage.ts` | Standard_LRS, Hot, StorageV2 |
| Blob Container | `cdn/storage.ts` | Name: `images`, public blob access, 7-day lifecycle |
| Cosmos DB Account | `cdn/cosmosdb.ts` | NoSQL, Serverless |
| Cosmos Database | `cdn/cosmosdb.ts` | Name: `cdn` |
| Cosmos Container | `cdn/cosmosdb.ts` | Name: `images`, PK: `/id`, TTL enabled |
| Key Vault | `cdn/keyvault.ts` | Standard, soft delete |
| Function App | `cdn/functions.ts` | Consumption Y1, Linux, Node.js, SystemAssigned |
| SB Queue | `cdn/service-bus-queue.ts` | On existing namespace, 1h TTL, no retry |
| APIM API | `cdn/api.ts` | `/cdn/v1`, OpenAPI import |
| APIM Policies | `cdn/policies.ts` | XML from `policies/` directory |

## Security Considerations

- No secrets hardcoded in Pulumi code (enforced by Semgrep)
- Pulumi secrets stored encrypted in stack config files
- Function App uses SystemAssigned managed identity
- APIM uses existing managed identity from rag-infra stack
- Cloudflare API token stored in Key Vault, retrieved at runtime
- RBAC follows least-privilege per resource
- OIDC federated identity for GitHub Actions (no stored credentials)
- Key Vault access restricted to Function App identity (Secret Get only)

## Test Strategy

Following the rag project pattern, infrastructure tests focus on pure config functions that are testable with Bun without the Pulumi runtime.

### RED Phase
- Write failing tests for `configs.ts` pure functions (naming, SKU, tags, environment differences)
- Write failing tests for project structure (Pulumi.yaml, tsconfig.json, package.json)
- Write failing tests for specification values (dev vs prod)

### GREEN Phase
- Implement `configs.ts` with pure functions returning plain objects
- Implement `specification.ts` with environment-specific values
- Create project scaffold files

### REFACTOR Phase
- Extract shared patterns
- Ensure config functions produce correct Azure CAF naming
- Validate all tests pass with `bun test`

### Quality Checks
- `bun test tests/unit/infra/` — Config function and project structure tests
- `pulumi preview` — Preview deployment changes
- `task quality` — Full quality gate (lint, typecheck, test)

## Acceptance Criteria

### Story 1.1: Azure Resource Provisioning
- [ ] AC1: Pulumi project scaffold in `infra/` with TypeScript, strict mode, correct dependencies
- [ ] AC2: Stack reference retrieves resource group, APIM, and Service Bus from rag-infra
- [ ] AC3: Storage account created with blob container `images`, public blob access, 7-day lifecycle
- [ ] AC4: Cosmos DB account created (serverless), database `cdn`, container `images` with `/id` partition key, TTL enabled
- [ ] AC5: Service Bus queue `image-metadata-extraction` created on existing namespace (1h TTL, no retry)
- [ ] AC6: Function App created with managed identity, RBAC roles assigned
- [ ] AC7: Key Vault created with Cloudflare API token secret placeholder
- [ ] AC8: All resources deployable via `task infra:up`

### Story 1.2: APIM Configuration
- [ ] AC9: CDN API registered at `/cdn/v1` in existing APIM with OpenAPI spec
- [ ] AC10: POST /images operation with policy from `policies/post-images.xml`
- [ ] AC11: GET /images/{hash} operation with policy from `policies/get-image.xml`
- [ ] AC12: APIM named values for cosmos-endpoint, blob-endpoint, servicebus-endpoint
- [ ] AC13: APIM managed identity has RBAC for Storage, Cosmos DB, Service Bus

### Story 1.3: Cloudflare Configuration
- [ ] AC14: Runbook documents DNS, origin, cache rules, Polish, WebP, API token

### Testing
- [ ] AC15: Pure config function tests pass with Bun
- [ ] AC16: Project structure tests validate scaffold

### Taskfile
- [ ] AC17: `task infra:init`, `infra:preview`, `infra:up`, `infra:down`, `infra:outputs` work

## Work Breakdown Structure

### Phase 1: Project Scaffold + Specification + Tests

| WBS | Deliverable | File |
|-----|------------|------|
| 1 | Pulumi project files | `infra/Pulumi.yaml`, `package.json`, `tsconfig.json` |
| 2 | Stack bridge | `infra/stack.ts` |
| 3 | Specification | `infra/specification.ts` |
| 4 | Project structure tests | `tests/unit/infra/project-setup.test.ts` |
| 5 | Specification tests | `tests/unit/infra/specification.test.ts` |

### Phase 2: Config Functions + Tests

| WBS | Deliverable | File |
|-----|------------|------|
| 6 | Pure config functions | `infra/cdn/configs.ts` |
| 7 | Config function tests | `tests/unit/infra/cdn-stack.test.ts` |

### Phase 3: Resource Modules

| WBS | Deliverable | File |
|-----|------------|------|
| 8 | Stack reference | `infra/index.ts` (imports) |
| 9 | Storage | `infra/cdn/storage.ts` |
| 10 | Cosmos DB | `infra/cdn/cosmosdb.ts` |
| 11 | Key Vault | `infra/cdn/keyvault.ts` |
| 12 | Function App | `infra/cdn/functions.ts` |
| 13 | RBAC | `infra/cdn/role-assignments.ts` |
| 14 | SB Queue | `infra/cdn/service-bus-queue.ts` |

### Phase 4: APIM Integration

| WBS | Deliverable | File |
|-----|------------|------|
| 15 | CDN API definition | `infra/cdn/api.ts` |
| 16 | Named values | `infra/cdn/named-values.ts` |
| 17 | Operation policies | `infra/cdn/policies.ts` |

### Phase 5: Taskfile + CI/CD

| WBS | Deliverable | File |
|-----|------------|------|
| 18 | Taskfile infra tasks | `Taskfile.yml` |
| 19 | Stack configs | `infra/Pulumi.dev.yaml`, `Pulumi.prod.yaml` |
| 20 | CI/CD workflow | `.github/workflows/deploy-infra.yml` |

### Phase 6: Cloudflare Runbook (Independent)

| WBS | Deliverable | File |
|-----|------------|------|
| 21 | Cloudflare setup guide | `docs/runbooks/cloudflare-setup.md` |

## File Summary

| File | Purpose |
|------|---------|
| `infra/Pulumi.yaml` | Pulumi project config (nodejs runtime) |
| `infra/Pulumi.dev.yaml` | Dev stack config |
| `infra/Pulumi.prod.yaml` | Prod stack config (with secrets) |
| `infra/package.json` | Pulumi dependencies |
| `infra/tsconfig.json` | TypeScript strict mode |
| `infra/index.ts` | Stack entrypoint with exports |
| `infra/stack.ts` | Environment bridge |
| `infra/specification.ts` | Environment-specific specs |
| `infra/cdn/configs.ts` | Pure config functions |
| `infra/cdn/storage.ts` | Storage Account + Container |
| `infra/cdn/cosmosdb.ts` | Cosmos DB Account + Database + Container |
| `infra/cdn/keyvault.ts` | Key Vault + Secret |
| `infra/cdn/functions.ts` | Function App + Identity |
| `infra/cdn/role-assignments.ts` | RBAC assignments |
| `infra/cdn/service-bus-queue.ts` | Queue on existing namespace |
| `infra/cdn/api.ts` | CDN API in APIM |
| `infra/cdn/policies.ts` | Operation policies |
| `infra/cdn/named-values.ts` | APIM named values |
| `tests/unit/infra/project-setup.test.ts` | Project structure tests |
| `tests/unit/infra/specification.test.ts` | Specification tests |
| `tests/unit/infra/cdn-stack.test.ts` | Config function tests |
| `.github/workflows/deploy-infra.yml` | CI/CD deployment |
| `docs/runbooks/cloudflare-setup.md` | Cloudflare setup guide |

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| rag-infra stack outputs change | Pin expected outputs in stack reference; version stack references |
| Pulumi state drift | Run `pulumi refresh` before deployments; CI preview step |
| RBAC propagation delay | Pulumi handles dependency ordering; add explicit `dependsOn` if needed |
| Cloudflare manual steps cause drift | Document in runbook; consider Terraform provider in future |
| Secrets leak | Use `pulumi config set --secret`; never pass plain-text secrets |
