/**
 * Environment-specific infrastructure specification.
 * Pure data — no Pulumi imports. Testable with Bun.
 */

export type Environment = "dev" | "prod";

export interface Spec {
  environment: Environment;
  location: string;
  tags: Record<string, string>;
  ragInfraStack: string;
  resourceGroup: {
    name: string;
  };
  storage: {
    accountName: string;
    containerName: string;
    skuName: string;
    accessTier: string;
    lifecycleDays: number;
  };
  cosmosDb: {
    accountName: string;
    databaseName: string;
    containerName: string;
    partitionKeyPath: string;
  };
  serviceBus: {
    queueName: string;
    messageTtl: string;
    maxDeliveryCount: number;
  };
  functionApp: {
    appName: string;
    planName: string;
    runtime: string;
    runtimeVersion: string;
  };
  keyVault: {
    vaultName: string;
    secretName: string;
  };
  apim: {
    apiName: string;
    apiPath: string;
    apiDisplayName: string;
  };
}

export function createSpec(env: Environment): Spec {
  const suffix = `${env}-uksouth-001`;

  return {
    environment: env,
    location: "uksouth",
    tags: {
      project: "cdn",
      environment: env,
      managedBy: "pulumi",
    },
    ragInfraStack: `lekman/rag-infra/${env}`,
    resourceGroup: {
      name: `rg-cdn-${suffix}`,
    },
    storage: {
      accountName: `stcdn${env}uksouth001`,
      containerName: "images",
      skuName: "Standard_LRS",
      accessTier: "Hot",
      lifecycleDays: 7,
    },
    cosmosDb: {
      accountName: `cosmos-cdn-${suffix}`,
      databaseName: "cdn",
      containerName: "images",
      partitionKeyPath: "/id",
    },
    serviceBus: {
      queueName: "image-metadata-extraction",
      messageTtl: "PT1H",
      maxDeliveryCount: 1,
    },
    functionApp: {
      appName: `func-cdn-${suffix}`,
      planName: "UKSouthLinuxDynamicPlan",
      runtime: "node",
      runtimeVersion: "20",
    },
    keyVault: {
      vaultName: `kv-cdn-${suffix}`,
      secretName: "cloudflare-api-token",
    },
    apim: {
      apiName: `cdn-api-${env}`,
      apiPath: "cdn/v1",
      apiDisplayName: "Edge Cache CDN API",
    },
  };
}
