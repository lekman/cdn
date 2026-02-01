import * as keyvault from "@pulumi/azure-native/keyvault";
import * as pulumi from "@pulumi/pulumi";
import { spec } from "../stack";
import { keyVaultConfig, keyVaultSecretConfig } from "./configs";

const ragStack = new pulumi.StackReference(spec.ragInfraStack);
const resourceGroupName = ragStack.getOutput("resourceGroupName") as pulumi.Output<string>;
const clientConfig = pulumi.output(pulumi.runtime.invoke("azure-native:authorization:getClientConfig", {}));

export const keyVault = new keyvault.Vault("keyvault", {
  ...keyVaultConfig(spec),
  resourceGroupName,
  properties: {
    tenantId: clientConfig.apply((c) => c.tenantId),
    sku: keyVaultConfig(spec).sku,
    enableSoftDelete: keyVaultConfig(spec).enableSoftDelete,
    softDeleteRetentionInDays: keyVaultConfig(spec).softDeleteRetentionInDays,
    accessPolicies: [],
  },
});

const secretConfig = keyVaultSecretConfig(spec);
export const cloudflareTokenSecret = new keyvault.Secret("cf-token-secret", {
  vaultName: keyVault.name,
  resourceGroupName,
  secretName: secretConfig.secretName,
  properties: {
    value: "placeholder-set-via-pulumi-config-or-ci",
  },
});
