# Edge Cache CDN Infrastructure

| Resource | Name |
|----------|------|
| Resource Group | \${outputs.resourceGroupName} |
| Storage Account | \${outputs.storageAccountName} |
| Cosmos DB Endpoint | \${outputs.cosmosAccountEndpoint} |
| Key Vault URI | \${outputs.keyVaultUri} |
| Function App | \${outputs.functionAppName} |
| Service Bus Queue | \${outputs.serviceBusQueueName} |

## Azure Portal

- [Resource Group](https://portal.azure.com/#@/resource/subscriptions/${outputs.subscriptionId}/resourceGroups/${outputs.resourceGroupName})
- [Function App](https://portal.azure.com/#@/resource/subscriptions/${outputs.subscriptionId}/resourceGroups/${outputs.resourceGroupName}/providers/Microsoft.Web/sites/${outputs.functionAppName})

## Architecture

CDN-owned resources (Storage, Cosmos, Key Vault, Function App) live in `${outputs.resourceGroupName}`.
APIM and Service Bus resources are managed by the [RAG infrastructure stack](https://app.pulumi.com/lekman/rag-infra).

### RBAC

- Function App managed identity: Storage Blob Data Contributor, Cosmos DB Data Contributor, Service Bus Data Receiver, Key Vault Secrets User
- APIM managed identity: Storage Blob Data Contributor, Cosmos DB Data Contributor (Service Bus Data Sender handled by RAG stack)

### CrossGuard Policies

Security policies are enforced via the `cdn-security` policy pack (MCSB-aligned).
