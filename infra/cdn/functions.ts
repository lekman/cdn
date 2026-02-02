import * as pulumi from "@pulumi/pulumi";
import * as web from "@pulumi/azure-native/web";
import { getClientConfig } from "@pulumi/azure-native/authorization";
import { spec } from "../stack";
import { functionAppConfig } from "./configs";
import { storageAccount } from "./storage";
import { cosmosAccount } from "./cosmosdb";
import { keyVault } from "./keyvault";
import { cdnResourceGroup } from "./resource-group";
import { serviceBusNamespaceName } from "./rag-stack";

const resourceGroupName = cdnResourceGroup.name;

// Consumption plan is auto-managed by Azure and cannot be created via ARM API
// on MSDN subscriptions. Bootstrap via: az functionapp create --consumption-plan-location uksouth
const clientConfig = pulumi.output(getClientConfig());

const serverFarmId = clientConfig.apply(
  (c) =>
    `/subscriptions/${c.subscriptionId}/resourceGroups/${spec.resourceGroup.name}/providers/Microsoft.Web/serverfarms/${spec.functionApp.planName}`,
);

const funcConfig = functionAppConfig(spec);
export const functionApp = new web.WebApp(
  "func",
  {
    ...funcConfig,
    resourceGroupName,
    serverFarmId,
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
          value: keyVault.properties.apply((p) => {
            if (!p.vaultUri) {
              throw new Error(
                "keyVault.properties.vaultUri is undefined; cannot set KEY_VAULT_URI",
              );
            }
            return p.vaultUri;
          }),
        },
      ],
    },
  },
  // Import the Function App if it was pre-created by the bootstrap action.
  // ARM_SUBSCRIPTION_ID is set in CI via OIDC login and locally via az login.
  // Pulumi ignores this option once the resource is already tracked in state.
  process.env.ARM_SUBSCRIPTION_ID
    ? {
        import: `/subscriptions/${process.env.ARM_SUBSCRIPTION_ID}/resourceGroups/${spec.resourceGroup.name}/providers/Microsoft.Web/sites/${spec.functionApp.appName}`,
      }
    : undefined,
);
