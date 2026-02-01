import * as fs from "node:fs";
import * as path from "node:path";
import * as apimanagement from "@pulumi/azure-native/apimanagement";
import { cdnApi } from "./api";
import { ragResourceGroupName, apimServiceName } from "./rag-stack";

const resourceGroupName = ragResourceGroupName;

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
    policyId: "policy",
    serviceName: apimServiceName,
    resourceGroupName,
    apiId: cdnApi.name,
    operationId: "uploadImage",
    format: "rawxml",
    value: postImagesPolicyXml,
  }),
  new apimanagement.ApiOperationPolicy("policy-get-image", {
    policyId: "policy",
    serviceName: apimServiceName,
    resourceGroupName,
    apiId: cdnApi.name,
    operationId: "getImageMetadata",
    format: "rawxml",
    value: getImagePolicyXml,
  }),
];
