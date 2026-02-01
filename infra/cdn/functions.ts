import * as web from "@pulumi/azure-native/web";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { appServicePlanConfig, functionAppConfig } from "./configs";
import { storageAccount } from "./storage";
import { cosmosAccount } from "./cosmosdb";
import { keyVault } from "./keyvault";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;
const serviceBusNamespaceName = ragStack.getOutput("serviceBusNamespaceName") as pulumi.Output<string>;

export const appServicePlan = new web.AppServicePlan("plan", {
  ...appServicePlanConfig(spec),
  resourceGroupName,
});

const funcConfig = functionAppConfig(spec);
export const functionApp = new web.WebApp("func", {
  ...funcConfig,
  resourceGroupName,
  serverFarmId: appServicePlan.id,
  siteConfig: {
    ...funcConfig.siteConfig,
    appSettings: [
      { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
      { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
      {
        name: "AzureWebJobsStorage__accountName",
        value: storageAccount.name,
      },
      {
        name: "COSMOS_ENDPOINT",
        value: cosmosAccount.documentEndpoint,
      },
      {
        name: "COSMOS_DATABASE",
        value: spec.cosmosDb.databaseName,
      },
      {
        name: "COSMOS_CONTAINER",
        value: spec.cosmosDb.containerName,
      },
      {
        name: "SERVICE_BUS_NAMESPACE",
        value: serviceBusNamespaceName,
      },
      {
        name: "SERVICE_BUS_QUEUE",
        value: spec.serviceBus.queueName,
      },
      {
        name: "KEY_VAULT_URI",
        value: keyVault.properties.apply((p) => p.vaultUri ?? ""),
      },
    ],
  },
});
