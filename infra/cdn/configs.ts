/**
 * Pure configuration functions for CDN stack resources.
 * Returns plain objects derived from a Spec — no Pulumi imports.
 * Testable with Bun without requiring Pulumi runtime (V8 intrinsics).
 */

import type { Spec } from "../specification";

/** Storage account configuration (excludes dynamic resourceGroupName). */
export function storageAccountConfig(spec: Spec) {
  return {
    accountName: spec.storage.accountName,
    location: spec.location,
    kind: "StorageV2" as const,
    sku: { name: spec.storage.skuName },
    accessTier: spec.storage.accessTier,
    allowBlobPublicAccess: true,
    minimumTlsVersion: "TLS1_2",
    enableHttpsTrafficOnly: true,
    tags: { ...spec.tags },
  };
}

/** Blob container configuration. */
export function blobContainerConfig(spec: Spec) {
  return {
    containerName: spec.storage.containerName,
    publicAccess: "Blob" as const,
  };
}

/** Lifecycle policy configuration. */
export function lifecyclePolicyConfig(spec: Spec) {
  return {
    ruleName: "delete-after-expiry",
    enabled: true,
    daysAfterCreation: spec.storage.lifecycleDays,
    blobTypes: ["blockBlob"] as string[],
    prefixMatch: [`${spec.storage.containerName}/`],
  };
}

/** Cosmos DB account configuration (excludes dynamic resourceGroupName). */
export function cosmosAccountConfig(spec: Spec) {
  return {
    accountName: spec.cosmosDb.accountName,
    location: spec.location,
    databaseAccountOfferType: "Standard" as const,
    capabilities: [{ name: "EnableServerless" }],
    consistencyPolicy: {
      defaultConsistencyLevel: "Session" as const,
    },
    locations: [
      {
        locationName: spec.location,
        failoverPriority: 0,
      },
    ],
    tags: { ...spec.tags },
  };
}

/** Cosmos DB database configuration. */
export function cosmosDatabaseConfig(spec: Spec) {
  return {
    databaseName: spec.cosmosDb.databaseName,
  };
}

/** Cosmos DB container configuration. */
export function cosmosContainerConfig(spec: Spec) {
  return {
    containerName: spec.cosmosDb.containerName,
    partitionKey: {
      paths: [spec.cosmosDb.partitionKeyPath],
      kind: "Hash" as const,
    },
    defaultTtl: -1,
  };
}

/** Service Bus queue configuration (excludes dynamic namespaceName). */
export function serviceBusQueueConfig(spec: Spec) {
  return {
    queueName: spec.serviceBus.queueName,
    defaultMessageTimeToLive: spec.serviceBus.messageTtl,
    maxDeliveryCount: spec.serviceBus.maxDeliveryCount,
    deadLetteringOnMessageExpiration: false,
  };
}

/** Function App plan configuration (excludes dynamic resourceGroupName). */
export function appServicePlanConfig(spec: Spec) {
  return {
    name: spec.functionApp.planName,
    location: spec.location,
    kind: "FunctionApp",
    sku: {
      name: "Y1",
      tier: "Dynamic",
    },
    reserved: true,
    tags: { ...spec.tags },
  };
}

/** Function App configuration (excludes dynamic resourceGroupName and appSettings). */
export function functionAppConfig(spec: Spec) {
  return {
    name: spec.functionApp.appName,
    location: spec.location,
    kind: "functionapp,linux",
    identity: {
      type: "SystemAssigned" as const,
    },
    siteConfig: {
      linuxFxVersion: `${spec.functionApp.runtime}|${spec.functionApp.runtimeVersion}`,
    },
    tags: { ...spec.tags },
  };
}

/** Key Vault configuration (excludes dynamic resourceGroupName and accessPolicies). */
export function keyVaultConfig(spec: Spec) {
  return {
    vaultName: spec.keyVault.vaultName,
    location: spec.location,
    sku: {
      family: "A" as const,
      name: "standard" as const,
    },
    enableSoftDelete: true,
    softDeleteRetentionInDays: 90,
    tags: { ...spec.tags },
  };
}

/** Key Vault secret name for Cloudflare API token. */
export function keyVaultSecretConfig(spec: Spec) {
  return {
    secretName: spec.keyVault.secretName,
  };
}

/** CDN API configuration for APIM (excludes dynamic serviceName). */
export function cdnApiConfig(spec: Spec) {
  return {
    apiId: spec.apim.apiName,
    displayName: spec.apim.apiDisplayName,
    path: spec.apim.apiPath,
    protocols: ["https"] as string[],
    apiType: "http" as const,
  };
}

/**
 * RBAC role definition IDs for Azure built-in roles.
 * Used for Function App managed identity and APIM managed identity.
 */
export const ROLE_DEFINITIONS = {
  storageBlobDataContributor: "ba92f5b4-2d11-453d-a403-e96b0029c9fe",
  cosmosDbDataContributor: "00000000-0000-0000-0000-000000000002",
  serviceBusDataReceiver: "4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0",
  serviceBusDataSender: "69a216fc-b8fb-44d8-bc22-1f3c2cd27a39",
  keyVaultSecretsUser: "4633458b-17de-408a-b874-0445c86b69e6",
} as const;
