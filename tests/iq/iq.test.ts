/**
 * IQ: Installation Qualification tests.
 * Verifies deployed Azure resources match the infrastructure specification.
 * Requires: az login, deployed stack (STACK env var, default: dev).
 *
 * Run: task test:iq -- dev
 */

import { describe, expect, test } from "bun:test";
import { createSpec, type Environment } from "../../infra/specification";
import { az } from "../helpers/az";
import { stackOutput } from "../helpers/stack-outputs";

const env = (process.env.STACK ?? "dev") as Environment;
const spec = createSpec(env);
const rg = spec.resourceGroup.name;
const ragStack = spec.ragInfraStack;

/** Timeout for az CLI calls (network-bound, varies by resource type). */
const AZ_TIMEOUT = 30_000;

// RAG stack resource names (resolved from RAG Pulumi stack outputs)
let ragRg: string;
let apimName: string;
let sbNamespace: string;

// Resolve cross-stack outputs before tests run
describe("IQ: resolve RAG stack outputs", () => {
  test(
    "RAG resource group name",
    async () => {
      ragRg = await stackOutput("resourceGroupName", ragStack);
      expect(ragRg).toBeTruthy();
    },
    AZ_TIMEOUT
  );

  test(
    "APIM service name",
    async () => {
      const gatewayUrl = await stackOutput("gatewayUrl", ragStack);
      apimName = new URL(gatewayUrl).hostname.split(".")[0]!;
      expect(apimName).toBeTruthy();
    },
    AZ_TIMEOUT
  );

  test(
    "Service Bus namespace name",
    async () => {
      sbNamespace = await stackOutput("serviceBusNamespaceName", ragStack);
      expect(sbNamespace).toBeTruthy();
    },
    AZ_TIMEOUT
  );
});

// --- CDN Resource Group resources ---

interface AzResource {
  name: string;
  location: string;
  tags: Record<string, string>;
}

describe(`IQ: resource group (${env})`, () => {
  let resource: AzResource;

  test(
    "exists",
    async () => {
      resource = await az<AzResource>(
        `group show --name ${rg} --query {name:name,location:location,tags:tags} --output json`
      );
      expect(resource.name).toBe(rg);
    },
    AZ_TIMEOUT
  );

  test("location matches spec", () => {
    expect(resource.location).toBe(spec.location);
  });

  test("tags match spec", () => {
    expect(resource.tags.project).toBe(spec.tags.project);
    expect(resource.tags.environment).toBe(spec.tags.environment);
    expect(resource.tags.managedBy).toBe(spec.tags.managedBy);
  });
});

interface StorageResource extends AzResource {
  sku: { name: string };
  accessTier: string;
  minimumTlsVersion: string;
}

describe(`IQ: storage account (${env})`, () => {
  let resource: StorageResource;

  test(
    "exists",
    async () => {
      resource = await az<StorageResource>(
        `storage account show --name ${spec.storage.accountName} --resource-group ${rg} --query {name:name,location:location,sku:sku,accessTier:accessTier,minimumTlsVersion:minimumTlsVersion,tags:tags} --output json`
      );
      expect(resource.name).toBe(spec.storage.accountName);
    },
    AZ_TIMEOUT
  );

  test("SKU matches spec", () => {
    expect(resource.sku.name).toBe(spec.storage.skuName);
  });

  test("access tier matches spec", () => {
    expect(resource.accessTier).toBe(spec.storage.accessTier);
  });

  test("TLS 1.2 minimum", () => {
    expect(resource.minimumTlsVersion).toBe("TLS1_2");
  });

  test("tags match spec", () => {
    expect(resource.tags.project).toBe(spec.tags.project);
    expect(resource.tags.environment).toBe(spec.tags.environment);
  });
});

describe(`IQ: blob container (${env})`, () => {
  test(
    "images container exists",
    async () => {
      const result = await az<{ name: string }>(
        `storage container show --name ${spec.storage.containerName} --account-name ${spec.storage.accountName} --auth-mode login --query {name:name} --output json`
      );
      expect(result.name).toBe(spec.storage.containerName);
    },
    AZ_TIMEOUT
  );
});

interface CosmosResource extends AzResource {
  documentEndpoint: string;
}

describe(`IQ: Cosmos DB account (${env})`, () => {
  let resource: CosmosResource;

  test(
    "exists",
    async () => {
      resource = await az<CosmosResource>(
        `cosmosdb show --name ${spec.cosmosDb.accountName} --resource-group ${rg} --query {name:name,location:location,documentEndpoint:documentEndpoint,tags:tags} --output json`
      );
      expect(resource.name).toBe(spec.cosmosDb.accountName);
    },
    AZ_TIMEOUT
  );

  test("tags match spec", () => {
    expect(resource.tags.project).toBe(spec.tags.project);
    expect(resource.tags.environment).toBe(spec.tags.environment);
  });
});

describe(`IQ: Cosmos DB database (${env})`, () => {
  test(
    "cdn database exists",
    async () => {
      const result = await az<{ name: string }>(
        `cosmosdb sql database show --account-name ${spec.cosmosDb.accountName} --resource-group ${rg} --name ${spec.cosmosDb.databaseName} --query {name:name} --output json`
      );
      expect(result.name).toBe(spec.cosmosDb.databaseName);
    },
    AZ_TIMEOUT
  );
});

interface CosmosContainerResource {
  name: string;
  resource: {
    partitionKey: {
      paths: string[];
    };
  };
}

describe(`IQ: Cosmos DB container (${env})`, () => {
  let container: CosmosContainerResource;

  test(
    "images container exists",
    async () => {
      container = await az<CosmosContainerResource>(
        `cosmosdb sql container show --account-name ${spec.cosmosDb.accountName} --resource-group ${rg} --database-name ${spec.cosmosDb.databaseName} --name ${spec.cosmosDb.containerName} --query {name:name,resource:resource} --output json`
      );
      expect(container.name).toBe(spec.cosmosDb.containerName);
    },
    AZ_TIMEOUT
  );

  test("partition key matches spec", () => {
    expect(container.resource.partitionKey.paths).toContain(spec.cosmosDb.partitionKeyPath);
  });
});

interface KeyVaultResource extends AzResource {
  properties: {
    enableSoftDelete: boolean;
  };
}

describe(`IQ: Key Vault (${env})`, () => {
  let resource: KeyVaultResource;

  test(
    "exists",
    async () => {
      resource = await az<KeyVaultResource>(
        `keyvault show --name ${spec.keyVault.vaultName} --resource-group ${rg} --query {name:name,location:location,properties:properties,tags:tags} --output json`
      );
      expect(resource.name).toBe(spec.keyVault.vaultName);
    },
    AZ_TIMEOUT
  );

  test("soft delete is enabled", () => {
    expect(resource.properties.enableSoftDelete).toBe(true);
  });

  test("tags match spec", () => {
    expect(resource.tags.project).toBe(spec.tags.project);
    expect(resource.tags.environment).toBe(spec.tags.environment);
  });
});

interface FunctionAppResource {
  name: string;
  identity: { type: string };
  siteConfig: {
    linuxFxVersion: string;
  };
}

describe(`IQ: Function App (${env})`, () => {
  let resource: FunctionAppResource;

  test(
    "exists",
    async () => {
      resource = await az<FunctionAppResource>(
        `functionapp show --name ${spec.functionApp.appName} --resource-group ${rg} --query {name:name,identity:identity,siteConfig:siteConfig} --output json`
      );
      expect(resource.name).toBe(spec.functionApp.appName);
    },
    AZ_TIMEOUT
  );

  test("has SystemAssigned managed identity", () => {
    expect(resource.identity.type).toContain("SystemAssigned");
  });

  test("runtime matches spec", () => {
    const version = resource.siteConfig.linuxFxVersion.toLowerCase();
    expect(version).toContain(spec.functionApp.runtime);
    expect(version).toContain(spec.functionApp.runtimeVersion);
  });
});

// --- RAG Resource Group resources (cross-stack) ---

interface QueueResource {
  name: string;
  maxDeliveryCount: number;
}

describe(`IQ: Service Bus queue (${env})`, () => {
  let queue: QueueResource;

  test(
    "exists",
    async () => {
      queue = await az<QueueResource>(
        `servicebus queue show --namespace-name ${sbNamespace} --resource-group ${ragRg} --name ${spec.serviceBus.queueName} --query {name:name,maxDeliveryCount:maxDeliveryCount} --output json`
      );
      expect(queue.name).toBe(spec.serviceBus.queueName);
    },
    AZ_TIMEOUT
  );

  test("max delivery count matches spec", () => {
    expect(queue.maxDeliveryCount).toBe(spec.serviceBus.maxDeliveryCount);
  });
});

interface ApiResource {
  name: string;
  path: string;
  protocols: string[];
  displayName: string;
}

describe(`IQ: APIM CDN API (${env})`, () => {
  let api: ApiResource;

  test(
    "exists with correct path",
    async () => {
      api = await az<ApiResource>(
        `apim api show --api-id ${spec.apim.apiName} --service-name ${apimName} --resource-group ${ragRg} --query {name:name,path:path,protocols:protocols,displayName:displayName} --output json`
      );
      expect(api.path).toBe(spec.apim.apiPath);
    },
    AZ_TIMEOUT
  );

  test("uses HTTPS protocol", () => {
    expect(api.protocols).toContain("https");
  });

  test("display name matches spec", () => {
    expect(api.displayName).toBe(spec.apim.apiDisplayName);
  });
});
