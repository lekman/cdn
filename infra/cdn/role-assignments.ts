import * as authorization from "@pulumi/azure-native/authorization";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { ROLE_DEFINITIONS } from "./configs";
import { storageAccount } from "./storage";
import { cosmosAccount } from "./cosmosdb";
import { keyVault } from "./keyvault";
import { functionApp } from "./functions";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const serviceBusNamespaceId = ragStack.getOutput("serviceBusNamespaceName") as pulumi.Output<string>;
const apimPrincipalId = ragStack.getOutput("apimId").apply((id) => {
  // APIM managed identity principal ID retrieved via the APIM resource
  return id;
}) as pulumi.Output<string>;

const funcPrincipalId = functionApp.identity.apply((id) => id?.principalId ?? "");

// Function App RBAC assignments
export const functionAppRoleAssignments = [
  new authorization.RoleAssignment("func-storage-contributor", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.storageBlobDataContributor}`,
    scope: storageAccount.id,
    principalId: funcPrincipalId,
    principalType: "ServicePrincipal",
  }),
  new authorization.RoleAssignment("func-cosmos-contributor", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.cosmosDbDataContributor}`,
    scope: cosmosAccount.id,
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

// APIM RBAC assignments (for managed identity policy-based access)
export const apimRoleAssignments = [
  new authorization.RoleAssignment("apim-storage-contributor", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.storageBlobDataContributor}`,
    scope: storageAccount.id,
    principalId: apimPrincipalId,
    principalType: "ServicePrincipal",
  }),
  new authorization.RoleAssignment("apim-cosmos-contributor", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.cosmosDbDataContributor}`,
    scope: cosmosAccount.id,
    principalId: apimPrincipalId,
    principalType: "ServicePrincipal",
  }),
  new authorization.RoleAssignment("apim-sb-sender", {
    roleDefinitionId: `/providers/Microsoft.Authorization/roleDefinitions/${ROLE_DEFINITIONS.serviceBusDataSender}`,
    scope: serviceBusNamespaceId,
    principalId: apimPrincipalId,
    principalType: "ServicePrincipal",
  }),
];
