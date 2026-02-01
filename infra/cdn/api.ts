import * as fs from "node:fs";
import * as path from "node:path";
import * as apimanagement from "@pulumi/azure-native/apimanagement";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { cdnApiConfig } from "./configs";
import { functionApp } from "./functions";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;
const apimServiceName = ragStack.getOutput("gatewayUrl").apply((url: string) => {
  return new URL(url).hostname.split(".")[0];
}) as pulumi.Output<string>;

const apiConfig = cdnApiConfig(spec);

// Read OpenAPI spec, strip servers array (APIM provides its own gateway)
const specPath = path.resolve(__dirname, "../../openapi/v1/cdn-api.json");
const specObj = JSON.parse(fs.readFileSync(specPath, "utf-8"));
delete specObj.servers;
const specContent = JSON.stringify(specObj);

export const cdnApi = new apimanagement.Api("cdn-api", {
  apiId: apiConfig.apiId,
  serviceName: apimServiceName,
  resourceGroupName,
  displayName: apiConfig.displayName,
  path: apiConfig.path,
  protocols: apiConfig.protocols as apimanagement.Protocol[],
  subscriptionRequired: true,
  // Function App backend for operations without inline policies (DELETE)
  serviceUrl: pulumi.interpolate`https://${functionApp.defaultHostName}/api`,
  format: "openapi+json",
  value: specContent,
});
