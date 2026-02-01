import * as fs from "node:fs";
import * as path from "node:path";
import { getClientConfig } from "@pulumi/azure-native/authorization";
import { cdnResourceGroup } from "./cdn/resource-group";
import { storageAccount, blobEndpoint } from "./cdn/storage";
import { cosmosAccount } from "./cdn/cosmosdb";
import { keyVault } from "./cdn/keyvault";
import { functionApp } from "./cdn/functions";
import { serviceBusQueue } from "./cdn/service-bus-queue";
import { cdnApi } from "./cdn/api";
import { cdnApiPolicies } from "./cdn/policies";
import { namedValues } from "./cdn/named-values";
import { functionAppRoleAssignments, apimRoleAssignments, cosmosRoleAssignments } from "./cdn/role-assignments";

// CDN stack outputs
export const resourceGroupName = cdnResourceGroup.name;
export const storageAccountName = storageAccount.name;
export const storageBlobEndpoint = blobEndpoint;
export const cosmosAccountEndpoint = cosmosAccount.documentEndpoint;
export const keyVaultUri = keyVault.properties.vaultUri;
export const functionAppName = functionApp.name;
export const serviceBusQueueName = serviceBusQueue.name;
export const cdnApiId = cdnApi.id;
export const cdnApiPolicyIds = cdnApiPolicies.map((p) => p.id);
export const namedValueIds = namedValues.map((nv) => nv.id);
export const functionAppRoleAssignmentIds = functionAppRoleAssignments.map((r) => r.id);
export const apimRoleAssignmentIds = apimRoleAssignments.map((r) => r.id);
export const cosmosRoleAssignmentIds = cosmosRoleAssignments.map((r) => r.id);

// Stack README (rendered in Pulumi Cloud UI with ${outputs.xxx} interpolation)
export const subscriptionId = getClientConfig().then((c) => c.subscriptionId);
export const readme = fs.readFileSync(
  path.resolve(__dirname, "Pulumi.README.md"),
  "utf-8",
);
