import * as fs from "node:fs";
import * as path from "node:path";
import * as apimanagement from "@pulumi/azure-native/apimanagement";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { cdnApi } from "./api";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;
const apimServiceName = ragStack.getOutput("gatewayUrl").apply((url: string) => {
  return new URL(url).hostname.split(".")[0];
}) as pulumi.Output<string>;

const postImagesPolicyXml = fs.readFileSync(
  path.resolve(__dirname, "../../policies/post-images.xml"),
  "utf-8",
);
const getImagePolicyXml = fs.readFileSync(
  path.resolve(__dirname, "../../policies/get-image.xml"),
  "utf-8",
);

export const cdnApiPolicies = [
  new apimanagement.ApiOperationPolicy("policy-upload-image", {
    serviceName: apimServiceName,
    resourceGroupName,
    apiId: cdnApi.name,
    operationId: "uploadImage",
    format: "rawxml",
    value: postImagesPolicyXml,
  }),
  new apimanagement.ApiOperationPolicy("policy-get-image", {
    serviceName: apimServiceName,
    resourceGroupName,
    apiId: cdnApi.name,
    operationId: "getImageMetadata",
    format: "rawxml",
    value: getImagePolicyXml,
  }),
];
