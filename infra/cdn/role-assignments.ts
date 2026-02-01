import * as authorization from "@pulumi/azure-native/authorization";
import * as documentdb from "@pulumi/azure-native/documentdb";
import * as pulumi from "@pulumi/pulumi";
import { ROLE_DEFINITIONS } from "./configs";
import { storageAccount } from "./storage";
import { cosmosAccount } from "./cosmosdb";
import { keyVault } from "./keyvault";
import { functionApp } from "./functions";
import { serviceBusNamespaceId, apimPrincipalId } from "./rag-stack";

const funcPrincipalId = functionApp.identity.apply((id) => id?.principalId ?? "");

// Cosmos DB data plane role definition (scoped to account, not Azure RBAC)
const cosmosDataContributorRoleId = pulumi.interpolate`${cosmosAccount.id}/sqlRoleDefinitions/${ROLE_DEFINITIONS.cosmosDbDataContributor}`;

// Function App Azure RBAC assignments
export const functionAppRoleAssignments = [
  new authorization.RoleAssignment("func-storage-contributor", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.storageBlobDataContributor}`,
    scope: storageAccount.id,
    principalId: funcPrincipalId,
    principalType: "ServicePrincipal",
  }),
  new authorization.RoleAssignment("func-sb-receiver", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.serviceBusDataReceiver}`,
    scope: serviceBusNamespaceId,
    principalId: funcPrincipalId,
    principalType: "ServicePrincipal",
  }),
  new authorization.RoleAssignment("func-kv-secrets", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.keyVaultSecretsUser}`,
    scope: keyVault.id,
    principalId: funcPrincipalId,
    principalType: "ServicePrincipal",
  }),
];

// Cosmos DB data plane role assignments (uses SqlRoleAssignment, not Azure RBAC).
// roleAssignmentId must be a stable GUID — Azure rejects non-GUID names.
export const cosmosRoleAssignments = [
  new documentdb.SqlResourceSqlRoleAssignment("func-cosmos-contributor", {
    roleAssignmentId: "a1c2e3f0-1234-5678-9abc-def012345678",
    accountName: cosmosAccount.name,
    resourceGroupName: cosmosAccount.id.apply((id) => id.split("/")[4]),
    roleDefinitionId: cosmosDataContributorRoleId,
    principalId: funcPrincipalId,
    scope: cosmosAccount.id,
  }),
  new documentdb.SqlResourceSqlRoleAssignment("apim-cosmos-contributor", {
    roleAssignmentId: "b2d3f4a1-2345-6789-abcd-ef0123456789",
    accountName: cosmosAccount.name,
    resourceGroupName: cosmosAccount.id.apply((id) => id.split("/")[4]),
    roleDefinitionId: cosmosDataContributorRoleId,
    principalId: apimPrincipalId,
    scope: cosmosAccount.id,
  }),
];

// APIM Azure RBAC assignments for CDN-owned resources.
// APIM→ServiceBus sender is handled by the RAG stack (namespace-level).
// APIM→Cosmos is handled above via Cosmos data plane RBAC.
export const apimRoleAssignments = [
  new authorization.RoleAssignment("apim-storage-contributor", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.storageBlobDataContributor}`,
    scope: storageAccount.id,
    principalId: apimPrincipalId,
    principalType: "ServicePrincipal",
  }),
];
