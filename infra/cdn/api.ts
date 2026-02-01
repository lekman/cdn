import * as fs from "node:fs";
import * as path from "node:path";
import * as apimanagement from "@pulumi/azure-native/apimanagement";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { cdnApiConfig } from "./configs";
import { functionApp } from "./functions";
import { ragResourceGroupName, apimServiceName } from "./rag-stack";

const resourceGroupName = ragResourceGroupName;

const apiConfig = cdnApiConfig(spec);

// Read OpenAPI spec, strip servers array (APIM provides its own gateway),
// and downgrade to 3.0.3 (APIM rejects 3.1.0 on import).
const specPath = path.resolve(__dirname, "../../openapi/v1/cdn-api.json");
const specObj = JSON.parse(fs.readFileSync(specPath, "utf-8"));
delete specObj.servers;
specObj.openapi = "3.0.3";

// Convert OAS 3.1 type arrays to OAS 3.0 nullable syntax.
// e.g. "type": ["string", "null"] → "type": "string", "nullable": true
function downgradeNullableTypes(obj: unknown): void {
  if (obj === null || typeof obj !== "object") return;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (key === "type" && Array.isArray(val) && val.includes("null")) {
      const nonNull = val.filter((t: string) => t !== "null");
      (obj as Record<string, unknown>).type = nonNull.length === 1 ? nonNull[0] : nonNull;
      (obj as Record<string, unknown>).nullable = true;
    } else {
      downgradeNullableTypes(val);
    }
  }
}
downgradeNullableTypes(specObj);

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
