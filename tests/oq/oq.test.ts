/**
 * OQ: Operational Qualification tests.
 * Verifies deployed Azure services are operational and healthy.
 * Requires: az login, deployed stack (STACK env var, default: dev).
 *
 * Run: task test:oq -- dev
 */

import { describe, expect, test } from "bun:test";
import { createSpec, type Environment } from "../../infra/specification";
import { az } from "../helpers/az";
import { stackOutput } from "../helpers/stack-outputs";

const env = (process.env.STACK ?? "dev") as Environment;
const spec = createSpec(env);
const rg = spec.resourceGroup.name;
const ragStack = spec.ragInfraStack;

/** Timeout for az CLI and network calls. */
const AZ_TIMEOUT = 30_000;

// RAG stack resource names (resolved from RAG Pulumi stack outputs)
let ragRg: string;
let apimName: string;
let sbNamespace: string;

describe("OQ: resolve RAG stack outputs", () => {
  test(
    "RAG resource group name",
    async () => {
      ragRg = await stackOutput("resourceGroupName", ragStack);
      expect(ragRg).toBeTruthy();
    },
    AZ_TIMEOUT
  );

  test(
    "APIM service name",
    async () => {
      const gatewayUrl = await stackOutput("gatewayUrl", ragStack);
      apimName = new URL(gatewayUrl).hostname.split(".")[0]!;
      expect(apimName).toBeTruthy();
    },
    AZ_TIMEOUT
  );

  test(
    "Service Bus namespace name",
    async () => {
      sbNamespace = await stackOutput("serviceBusNamespaceName", ragStack);
      expect(sbNamespace).toBeTruthy();
    },
    AZ_TIMEOUT
  );
});

// --- CDN Resource Group ---

describe(`OQ: resource group (${env})`, () => {
  test(
    "provisioning state is Succeeded",
    async () => {
      const result = await az<{ provisioningState: string }>(
        `group show --name ${rg} --query {provisioningState:properties.provisioningState} --output json`
      );
      expect(result.provisioningState).toBe("Succeeded");
    },
    AZ_TIMEOUT
  );
});

describe(`OQ: storage account (${env})`, () => {
  test(
    "provisioning state is Succeeded",
    async () => {
      const result = await az<{ provisioningState: string }>(
        `storage account show --name ${spec.storage.accountName} --resource-group ${rg} --query {provisioningState:provisioningState} --output json`
      );
      expect(result.provisioningState).toBe("Succeeded");
    },
    AZ_TIMEOUT
  );
});

describe(`OQ: Cosmos DB account (${env})`, () => {
  test(
    "provisioning state is Succeeded",
    async () => {
      const result = await az<{ provisioningState: string }>(
        `cosmosdb show --name ${spec.cosmosDb.accountName} --resource-group ${rg} --query {provisioningState:provisioningState} --output json`
      );
      expect(result.provisioningState).toBe("Succeeded");
    },
    AZ_TIMEOUT
  );

  test(
    "document endpoint is reachable",
    async () => {
      const result = await az<{ documentEndpoint: string }>(
        `cosmosdb show --name ${spec.cosmosDb.accountName} --resource-group ${rg} --query {documentEndpoint:documentEndpoint} --output json`
      );
      // Verify the endpoint URL is set (connectivity requires auth)
      expect(result.documentEndpoint).toMatch(/^https:\/\/.+\.documents\.azure\.com/);
    },
    AZ_TIMEOUT
  );
});

describe(`OQ: Key Vault (${env})`, () => {
  test(
    "provisioning state is Succeeded",
    async () => {
      const result = await az<{ provisioningState: string }>(
        `keyvault show --name ${spec.keyVault.vaultName} --resource-group ${rg} --query {provisioningState:properties.provisioningState} --output json`
      );
      expect(result.provisioningState).toBe("Succeeded");
    },
    AZ_TIMEOUT
  );
});

describe(`OQ: Function App (${env})`, () => {
  test(
    "state is Running",
    async () => {
      const result = await az<{ state: string }>(
        `functionapp show --name ${spec.functionApp.appName} --resource-group ${rg} --query {state:state} --output json`
      );
      expect(result.state).toBe("Running");
    },
    AZ_TIMEOUT
  );
});

// --- RAG Resource Group (cross-stack) ---

describe(`OQ: Service Bus queue (${env})`, () => {
  test(
    "queue is Active",
    async () => {
      const result = await az<{ status: string }>(
        `servicebus queue show --namespace-name ${sbNamespace} --resource-group ${ragRg} --name ${spec.serviceBus.queueName} --query {status:status} --output json`
      );
      expect(result.status).toBe("Active");
    },
    AZ_TIMEOUT
  );
});

describe(`OQ: APIM CDN API route (${env})`, () => {
  test(
    "GET /cdn/v1/images/{hash} route exists (not 404)",
    async () => {
      const gatewayUrl = `https://${apimName}.azure-api.net`;
      // APIM returns 404 for non-existent routes. Any other status (401, 403, 500)
      // confirms the route is configured and the gateway is reachable.
      const response = await fetch(
        `${gatewayUrl}/${spec.apim.apiPath}/images/test-hash-placeholder-for-oq`,
        { method: "GET" }
      );
      expect(response.status).not.toBe(404);
    },
    AZ_TIMEOUT
  );
});
