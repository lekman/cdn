import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as storage from "@pulumi/azure-native/storage";
import * as web from "@pulumi/azure-native/web";

// Create an Azure Resource Group named "functions-rg"
const resourceGroup = new resources.ResourceGroup("functions-rg", {
    resourceGroupName: "functions-rg",
});

// Create a StorageV2 account with Standard_LRS SKU
const storageAccount = new storage.StorageAccount("storage", {
    resourceGroupName: resourceGroup.name,
    sku: {
        name: storage.SkuName.Standard_LRS,
    },
    kind: storage.Kind.StorageV2,
});

// Create a blob container named "zips" to store function code
const zipsContainer = new storage.BlobContainer("zips", {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    containerName: "zips",
    publicAccess: storage.PublicAccess.None,
});

// Package the function implementation from the local javascript directory as a FileArchive blob
const codeBlob = new storage.Blob("code", {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    containerName: zipsContainer.name,
    blobName: "functionapp.zip",
    source: new pulumi.asset.FileArchive("./javascript"),
    type: storage.BlobType.Block,
});

// Create a Consumption Plan (Y1 tier) App Service Plan for serverless execution
const appServicePlan = new web.AppServicePlan("plan", {
    resourceGroupName: resourceGroup.name,
    kind: "FunctionApp",
    reserved: true, // Required for Linux
    sku: {
        name: "Y1",
        tier: "Dynamic",
    },
});

// Get the storage account keys for the connection string
const storageAccountKeys = storage.listStorageAccountKeysOutput({
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
});

const primaryStorageKey = storageAccountKeys.keys[0].value;

// Build the AzureWebJobsStorage connection string
const storageConnectionString = pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${primaryStorageKey};EndpointSuffix=core.windows.net`;

// Generate a signed SAS URL for the code blob (valid for 1 year)
const codeBlobSas = storage.listStorageAccountServiceSASOutput({
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    protocols: storage.HttpProtocol.Https,
    sharedAccessStartTime: "2024-01-01T00:00:00Z",
    sharedAccessExpiryTime: "2100-01-01T00:00:00Z",
    resource: storage.SignedResource.B, // Blob
    permissions: storage.Permissions.R, // Read
    canonicalizedResource: pulumi.interpolate`/blob/${storageAccount.name}/${zipsContainer.name}/${codeBlob.name}`,
});

// Build the full SAS URL for WEBSITE_RUN_FROM_PACKAGE
const codeBlobUrl = pulumi.interpolate`https://${storageAccount.name}.blob.core.windows.net/${zipsContainer.name}/${codeBlob.name}?${codeBlobSas.serviceSasToken}`;

// Create the Function App with required configuration
const functionApp = new web.WebApp("func", {
    resourceGroupName: resourceGroup.name,
    serverFarmId: appServicePlan.id,
    kind: "FunctionApp,Linux",
    reserved: true, // Required for Linux
    siteConfig: {
        appSettings: [
            {
                name: "FUNCTIONS_EXTENSION_VERSION",
                value: "~3",
            },
            {
                name: "FUNCTIONS_WORKER_RUNTIME",
                value: "node",
            },
            {
                name: "WEBSITE_NODE_DEFAULT_VERSION",
                value: "~14",
            },
            {
                name: "AzureWebJobsStorage",
                value: storageConnectionString,
            },
            {
                name: "WEBSITE_RUN_FROM_PACKAGE",
                value: codeBlobUrl,
            },
        ],
        http20Enabled: true,
        linuxFxVersion: "node|14",
    },
});

// Export the HTTPS endpoint for the HelloNode function
export const helloNodeEndpoint = pulumi.interpolate`https://${functionApp.defaultHostName}/api/HelloNode`;
