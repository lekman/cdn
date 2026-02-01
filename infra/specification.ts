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
  return {
    environment: env,
    location: "uksouth",
    tags: {
      project: "cdn",
      environment: env,
      managedBy: "pulumi",
    },
    ragInfraStack: `rag-infra/${env}`,
    storage: {
      accountName: `cdn${env}sa`.replace(/-/g, ""),
      containerName: "images",
      skuName: "Standard_LRS",
      accessTier: "Hot",
      lifecycleDays: 7,
    },
    cosmosDb: {
      accountName: `cdn-${env}-cosmos`,
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
      appName: `cdn-${env}-func`,
      planName: `cdn-${env}-plan`,
      runtime: "node",
      runtimeVersion: "~4",
    },
    keyVault: {
      vaultName: `cdn-${env}-kv`,
      secretName: "cloudflare-api-token",
    },
    apim: {
      apiName: `cdn-api-${env}`,
      apiPath: "cdn/v1",
      apiDisplayName: "Edge Cache CDN API",
    },
  };
}
