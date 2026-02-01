/**
 * CrossGuard policy definitions aligned with MCSB controls.
 * Pure data — no Pulumi runtime dependency.
 * The index.ts file consumes these to build the PolicyPack.
 */

export interface PolicyDefinition {
  name: string;
  description: string;
  enforcementLevel: "advisory" | "mandatory" | "disabled";
  mcsbControl: string;
  resourceType: string;
}

export const policyDefinitions: PolicyDefinition[] = [
  {
    name: "storage-tls-required",
    description: "Storage accounts must use TLS 1.2 or higher",
    enforcementLevel: "mandatory",
    mcsbControl: "DP-3",
    resourceType: "azure-native:storage:StorageAccount",
  },
  {
    name: "storage-https-transfer",
    description: "Storage accounts must enforce HTTPS transfer",
    enforcementLevel: "mandatory",
    mcsbControl: "DP-3",
    resourceType: "azure-native:storage:StorageAccount",
  },
  {
    name: "cosmos-managed-identity",
    description: "Cosmos DB should disable local auth in favour of managed identity",
    enforcementLevel: "advisory",
    mcsbControl: "IM-1",
    resourceType: "azure-native:documentdb:DatabaseAccount",
  },
  {
    name: "keyvault-soft-delete",
    description: "Key Vault must have soft delete enabled",
    enforcementLevel: "mandatory",
    mcsbControl: "DP-1",
    resourceType: "azure-native:keyvault:Vault",
  },
  {
    name: "function-managed-identity",
    description: "Function App must use managed identity",
    enforcementLevel: "mandatory",
    mcsbControl: "IM-1",
    resourceType: "azure-native:web:WebApp",
  },
  {
    name: "apim-https-only",
    description: "APIM APIs must enforce HTTPS-only protocols",
    enforcementLevel: "mandatory",
    mcsbControl: "NS-8",
    resourceType: "azure-native:apimanagement:Api",
  },
  {
    name: "resource-tagging",
    description: "All resources must have project, environment, and managedBy tags",
    enforcementLevel: "mandatory",
    mcsbControl: "PM-1",
    resourceType: "*",
  },
];
