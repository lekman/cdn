import * as storage from "@pulumi/azure-native/storage";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { blobContainerConfig, lifecyclePolicyConfig, storageAccountConfig } from "./configs";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;

const storageConfig = storageAccountConfig(spec);
export const storageAccount = new storage.StorageAccount("storage", {
  ...storageConfig,
  accessTier: storageConfig.accessTier as storage.AccessTier,
  resourceGroupName,
});

const blobService = new storage.BlobServiceProperties("blob-service", {
  accountName: storageAccount.name,
  resourceGroupName,
  blobServicesName: "default",
});

export const imagesContainer = new storage.BlobContainer("images-container", {
  ...blobContainerConfig(spec),
  accountName: storageAccount.name,
  resourceGroupName,
});

const lifecycle = lifecyclePolicyConfig(spec);
export const lifecyclePolicy = new storage.ManagementPolicy("lifecycle", {
  accountName: storageAccount.name,
  resourceGroupName,
  managementPolicyName: "default",
  policy: {
    rules: [
      {
        name: lifecycle.ruleName,
        enabled: lifecycle.enabled,
        type: "Lifecycle",
        definition: {
          actions: {
            baseBlob: {
              delete: {
                daysAfterModificationGreaterThan: lifecycle.daysAfterCreation,
              },
            },
          },
          filters: {
            blobTypes: lifecycle.blobTypes,
            prefixMatch: lifecycle.prefixMatch,
          },
        },
      },
    ],
  },
});

export const blobEndpoint = storageAccount.primaryEndpoints.apply((ep) => ep.blob);
