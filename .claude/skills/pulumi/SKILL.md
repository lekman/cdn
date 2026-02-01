---
name: pulumi
description: Pulumi infrastructure patterns for this Azure project. Use when creating or modifying infrastructure resources, adding Azure services, configuring OIDC, or writing infrastructure tests.
user-invocable: false
---

<!-- This skill follows the Agent Skills open standard: https://agentskills.io -->

# Pulumi Infrastructure Patterns

This skill documents the design patterns and conventions for the Pulumi infrastructure in this repository.

## Azure Resource Naming

All resources follow the Azure Cloud Adoption Framework naming convention:

```
{resource-type}-{project}-{environment}-{location}-{instance}
```

The naming is driven by a central specification function in `infra/specification.ts`:

```typescript
export function createSpec(env: Environment) {
  const suffix = `${env}-uksouth-001`;
  return {
    apim: {
      resourceGroup: `rg-rag-${suffix}`,
      instanceName: `apim-rag-${suffix}`,
      logAnalyticsWorkspace: `log-rag-${suffix}`,
    },
    serviceBus: {
      namespaceName: `sb-rag-${suffix}`,
    },
    budget: {
      name: `budget-rag-${suffix}`,
    },
    tags: { project: "rag", environment: env, managedBy: "pulumi" },
  };
}
```

### Naming Rules

| Prefix | Resource Type | Example |
|--------|---------------|---------|
| `rg-` | Resource Group | `rg-rag-dev-uksouth-001` |
| `apim-` | API Management | `apim-rag-dev-uksouth-001` |
| `sb-` | Service Bus | `sb-rag-dev-uksouth-001` |
| `log-` | Log Analytics | `log-rag-dev-uksouth-001` |
| `budget-` | Budget | `budget-rag-dev-uksouth-001` |

All tags must include `project`, `environment`, and `managedBy`.

## Directory Structure

```
infra/
  specification.ts       # Pure config: naming, SKUs, tags (no Pulumi imports)
  stack.ts               # Bridge: maps Pulumi stack name to Environment
  index.ts               # Entrypoint: exports all resource IDs
  apim/                  # Shared infrastructure module
    configs.ts           # Pure config functions (testable)
    resource-group.ts    # Resource group
    instance.ts          # APIM service + cert injection
    service-bus.ts       # Service Bus namespace
    role-assignment.ts   # APIM managed identity roles
    diagnostics.ts       # Log Analytics workspace
    budget.ts            # Resource group budget
    global-policy.ts     # APIM global security policy
  rag/                   # RAG API module
    configs.ts           # Pure config functions (testable)
    api.ts               # RAG API definition
    products.ts          # APIM products
    queues.ts            # Service Bus queues
    webhooks.ts          # Webhook operations + policies
    policies.ts          # Rate limit + CORS policy
```

## Design Patterns

### 1. Specification Pattern

Separate configuration from infrastructure. `specification.ts` contains no Pulumi imports and is fully unit-testable:

```typescript
// specification.ts - pure data, no side effects
export function createSpec(env: Environment) { ... }
```

### 2. Config Functions

Each module has a `configs.ts` with pure functions that transform the Spec into resource config objects. These are the primary unit test target:

```typescript
// apim/configs.ts
export function resourceGroupConfig(spec: Spec) {
  return {
    resourceGroupName: spec.apim.resourceGroup,
    location: spec.apim.location,
    tags: { ...spec.tags },
  };
}
```

### 3. Resource Files

Resource files import config functions and create Pulumi resources. Dependencies are expressed through imports:

```typescript
// service-bus.ts
import { resourceGroup } from "./resource-group";
export const serviceBusNamespace = new servicebus.Namespace("sb", {
  ...serviceBusConfig(spec),
  resourceGroupName: resourceGroup.name,
});
```

### 4. Array Mapping for 1-to-Many Resources

```typescript
export const webhookQueues = queues.map(
  (q) => new servicebus.Queue(`queue-${q.source}`, { ... })
);
```

### 5. Environment Branching

Prod-specific behavior (custom domain, Cloudflare WAF) uses conditional logic, not separate files:

```typescript
if (env === "prod") {
  policyXml = cfHeaderValue.apply((value) =>
    buildGlobalPolicyXml({ name: cfHeaderName, value })
  );
} else {
  policyXml = buildGlobalPolicyXml();
}
```

### 6. Stack Configuration

Pulumi stacks map 1:1 to environments. `stack.ts` validates the stack name:

```typescript
const validEnvs = new Set<string>(["dev", "prod"]);
const stackName = pulumi.getStack();
if (!validEnvs.has(stackName)) {
  throw new Error(`Pulumi stack name must be "dev" or "prod", got "${stackName}"`);
}
export const env: Environment = stackName as Environment;
export const spec = createSpec(env);
```

Secrets are stored per-stack in `Pulumi.prod.yaml`:

```yaml
config:
  "rag-infra:cfHeaderName": X-Origin-Verify
  "rag-infra:cfHeaderValue": { secure: <encrypted> }
  "rag-infra:apimCertPfx": { secure: <encrypted> }
  "rag-infra:apimCertPassword": { secure: <encrypted> }
```

## Taskfile Commands

Infrastructure tasks are defined in `Taskfile.yml` with short aliases:

| Command | Alias | Purpose |
|---------|-------|---------|
| `task infra:init` | `init` | Initialize dev + prod Pulumi stacks |
| `task infra:preview -- dev` | `pre` | Preview changes |
| `task infra:up -- dev` | `up` | Deploy to Azure |
| `task infra:down -- dev` | `down` | Destroy resources + purge soft-deletes |
| `task infra:delete` | `delete` | Purge soft-deleted APIM services matching `rag-{stack}` |
| `task infra:refresh -- dev` | `ref` | Refresh Pulumi state from Azure |
| `task infra:outputs -- dev` | `out` | Show stack outputs as JSON |
| `task infra:cf-header` | | Setup Cloudflare WAF header secret |
| `task infra:cf-cert` | | Setup Cloudflare Origin CA certificate |
| `task oidc:setup` | `oidc` | Setup Azure OIDC for CI/CD |
| `task test:iq -- dev` | `iq` | Installation Qualification tests |
| `task test:oq -- dev` | `oq` | Operational Qualification tests |

All infrastructure tasks require `az login` and `pulumi login` (enforced by `infra:check-prereqs`).

Default stack is `dev` for all commands. Pass `-- prod` to target production.

## OIDC and Permissions

### OIDC Setup

`task oidc:setup` configures passwordless Azure authentication for GitHub Actions:

1. Creates Azure AD app registration (`github-rag-ci`)
2. Creates a service principal
3. Creates three federated identity credentials:
   - `github-main`: `repo:lekman/rag:ref:refs/heads/main`
   - `github-pr`: `repo:lekman/rag:pull_request`
   - `github-production`: `repo:lekman/rag:environment:production`
4. Assigns subscription-level roles:
   - **Contributor**: create/manage Azure resources
   - **User Access Administrator**: create role assignments (needed because Pulumi creates APIM managed identity role bindings)
5. Sets GitHub variables: `ARM_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID`

The task is idempotent and safe to re-run.

### CI/CD Workflow Permissions

Jobs that deploy infrastructure require `id-token: write` permission to request a GitHub OIDC token:

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ vars.ARM_CLIENT_ID }}
    tenant-id: ${{ vars.ARM_TENANT_ID }}
    subscription-id: ${{ vars.ARM_SUBSCRIPTION_ID }}
```

Environment variables for Pulumi:

```yaml
env:
  ARM_USE_OIDC: "true"
  ARM_CLIENT_ID: ${{ vars.ARM_CLIENT_ID }}
  ARM_TENANT_ID: ${{ vars.ARM_TENANT_ID }}
  ARM_SUBSCRIPTION_ID: ${{ vars.ARM_SUBSCRIPTION_ID }}
  PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### Managed Identity Role Assignments

APIM uses a system-assigned managed identity to send messages to Service Bus. This is configured in `infra/apim/role-assignment.ts`:

- Role: Azure Service Bus Data Sender (`69a216fc-b8fb-44d8-bc22-1f3c2cd27a39`)
- Principal: APIM managed identity
- Scope: Service Bus namespace

### Secret Layers

| Layer | Storage | Examples |
|-------|---------|---------|
| OIDC | No stored secrets | Azure credentials via federated token exchange |
| GitHub Variables | GitHub repo settings | `ARM_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID` |
| GitHub Secrets | GitHub encrypted | `PULUMI_ACCESS_TOKEN`, `CODECOV_TOKEN` |
| Pulumi Secrets | Pulumi Cloud encrypted | `cfHeaderValue`, `apimCertPfx`, `apimCertPassword` |

## Testing: Unit + GAMP Validation

### Unit Tests (Business Logic)

Pulumi resources are tested as pure config functions, not as Pulumi runtime objects (Bun does not support V8 intrinsics required by Pulumi mocks).

Test both `dev` and `prod` specs:

```typescript
// tests/unit/infra/apim-stack.test.ts
import { createSpec } from "../../../infra/specification";
import { resourceGroupConfig } from "../../../infra/apim/configs";

const dev = createSpec("dev");
const prod = createSpec("prod");

describe("Unit: APIM stack - Resource Group config", () => {
  for (const [name, spec] of [["dev", dev], ["prod", prod]] as const) {
    describe(name, () => {
      const config = resourceGroupConfig(spec);
      test("uses specification resource group name", () => {
        expect(config.resourceGroupName).toBe(spec.apim.resourceGroup);
      });
      test("has project tags", () => {
        expect(config.tags).toEqual(spec.tags);
      });
    });
  }
});
```

When adding a new resource:

1. Add naming to `specification.ts`
2. Create a config function in the module's `configs.ts`
3. Write unit tests for the config function (both dev and prod)
4. Create the resource file that uses the config function

### GAMP Validation

This project implements Good Automated Manufacturing Practice validation:

#### Installation Qualification (IQ) - `tests/iq/`

Verifies deployed Azure resources match the specification. Uses `az` CLI to query live resources and assert against `createSpec()` values:

```typescript
// tests/iq/iq.test.ts
const spec = createSpec(env);

describe(`IQ: APIM service (${env})`, () => {
  test("SKU matches spec", () => {
    expect(resource.sku.name).toBe(spec.apim.sku.name);
  });
  test("has SystemAssigned managed identity", () => {
    expect(resource.identity.type).toBe("SystemAssigned");
  });
});
```

IQ checks: resource existence, naming, SKU, tags, managed identity, queue settings, API paths, product configuration.

Run with: `task test:iq -- dev`

#### Operational Qualification (OQ) - `tests/oq/`

Verifies deployed services are healthy and responding:

```typescript
// tests/oq/oq.test.ts
describe(`OQ: APIM gateway (${env})`, () => {
  test("gateway is reachable", async () => {
    const response = await fetch(gatewayUrl);
    expect(response.status).toBeLessThan(500);
  });
});

describe(`OQ: Service Bus operational (${env})`, () => {
  test("namespace is Active", async () => {
    const result = await az<{ status: string }>(`servicebus namespace show ...`);
    expect(result.status).toBe("Active");
  });
});
```

OQ checks: gateway reachability, provisioning state, service status, route existence (202/401/403 = route configured).

Run with: `task test:oq -- dev`

### Validation Summary

| GAMP Phase | Test Layer | Location | What It Verifies |
|-----------|-----------|----------|-----------------|
| DQ | Unit tests | `tests/unit/infra/` | Config functions produce correct values |
| IQ | IQ tests | `tests/iq/` | Deployed resources match spec |
| OQ | OQ tests | `tests/oq/` | Services are healthy and responding |

### Coverage

Business logic (config functions): 80%+ target. System files (`*.system.ts`), IQ, and OQ tests are excluded from coverage.
