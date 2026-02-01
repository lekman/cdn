import * as apimanagement from "@pulumi/azure-native/apimanagement";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { storageAccount } from "./storage";
import { cosmosAccount } from "./cosmosdb";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;
const apimServiceName = ragStack.getOutput("gatewayUrl").apply((url: string) => {
  return new URL(url).hostname.split(".")[0];
}) as pulumi.Output<string>;
const serviceBusNamespaceName = ragStack.getOutput("serviceBusNamespaceName") as pulumi.Output<string>;

export const namedValues = [
  new apimanagement.NamedValue("nv-cosmos-endpoint", {
    serviceName: apimServiceName,
    resourceGroupName,
    namedValueId: "cosmos-endpoint",
    displayName: "cosmos-endpoint",
    value: cosmosAccount.documentEndpoint,
  }),
  new apimanagement.NamedValue("nv-blob-endpoint", {
    serviceName: apimServiceName,
    resourceGroupName,
    namedValueId: "blob-endpoint",
    displayName: "blob-endpoint",
    value: storageAccount.primaryEndpoints.apply((ep) => ep.blob),
  }),
  new apimanagement.NamedValue("nv-servicebus-endpoint", {
    serviceName: apimServiceName,
    resourceGroupName,
    namedValueId: "servicebus-endpoint",
    displayName: "servicebus-endpoint",
    value: pulumi.interpolate`https://${serviceBusNamespaceName}.servicebus.windows.net`,
  }),
];
