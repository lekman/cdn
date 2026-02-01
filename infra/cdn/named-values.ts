import * as apimanagement from "@pulumi/azure-native/apimanagement";
import * as pulumi from "@pulumi/pulumi";
import { storageAccount } from "./storage";
import { cosmosAccount } from "./cosmosdb";
import {
  ragResourceGroupName,
  apimServiceName,
  serviceBusNamespaceName,
} from "./rag-stack";

const resourceGroupName = ragResourceGroupName;

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
