/**
 * Shared StackReference for the RAG infrastructure stack.
 * All modules that need RAG stack outputs import from here
 * to avoid duplicate StackReference URNs.
 */

import * as apimanagement from "@pulumi/azure-native/apimanagement";
import * as pulumi from "@pulumi/pulumi";
import { getClientConfig } from "@pulumi/azure-native/authorization";
import { spec } from "../stack";

export const ragStack = new pulumi.StackReference("rag-infra", {
  name: spec.ragInfraStack,
});

export const ragResourceGroupName = ragStack.getOutput(
  "resourceGroupName",
) as pulumi.Output<string>;

export const apimServiceName = ragStack
  .getOutput("gatewayUrl")
  .apply((url: string) => {
    return new URL(url).hostname.split(".")[0];
  }) as pulumi.Output<string>;

export const serviceBusNamespaceName = ragStack.getOutput(
  "serviceBusNamespaceName",
) as pulumi.Output<string>;

// Construct full resource ID for RBAC scope (namespace name alone is not valid)
const subscriptionId = getClientConfig().then((c) => c.subscriptionId);
export const serviceBusNamespaceId = pulumi
  .all([subscriptionId, ragResourceGroupName, serviceBusNamespaceName])
  .apply(
    ([subId, rgName, nsName]) =>
      `/subscriptions/${subId}/resourceGroups/${rgName}/providers/Microsoft.ServiceBus/namespaces/${nsName}`,
  );

// Look up APIM managed identity principal ID (apimId output is the resource ID, not the principal)
export const apimPrincipalId = apimanagement
  .getApiManagementServiceOutput({
    resourceGroupName: ragResourceGroupName,
    serviceName: apimServiceName,
  })
  .apply((svc: { identity?: { principalId?: string } }) => svc.identity?.principalId ?? "");
