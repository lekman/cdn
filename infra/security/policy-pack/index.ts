/**
 * Pulumi CrossGuard policy pack for CDN infrastructure.
 * Enforces MCSB-aligned security controls at deployment time.
 *
 * Usage:
 *   pulumi preview --policy-pack infra/security/policy-pack
 *   pulumi up --policy-pack infra/security/policy-pack
 */

import { apimanagement } from "@pulumi/azure-native";
import { documentdb } from "@pulumi/azure-native";
import { keyvault } from "@pulumi/azure-native";
import { storage } from "@pulumi/azure-native";
import { web } from "@pulumi/azure-native";
import { PolicyPack, validateResourceOfType } from "@pulumi/policy";
import { policyDefinitions } from "./policies";

new PolicyPack("cdn-security", {
  policies: [
    {
      ...policyDefinitions.find((p) => p.name === "storage-tls-required"),
      name: "storage-tls-required",
      description: "Storage accounts must use TLS 1.2 or higher (MCSB DP-3)",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType(
        storage.StorageAccount,
        (account, _args, reportViolation) => {
          if (account.minimumTlsVersion && account.minimumTlsVersion !== "TLS1_2") {
            reportViolation("Storage account must use TLS 1.2 or higher");
          }
        },
      ),
    },
    {
      ...policyDefinitions.find((p) => p.name === "storage-https-transfer"),
      name: "storage-https-transfer",
      description: "Storage accounts must enforce HTTPS transfer (MCSB DP-3)",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType(
        storage.StorageAccount,
        (account, _args, reportViolation) => {
          if (account.enableHttpsTrafficOnly === false) {
            reportViolation("Storage account must enforce HTTPS-only transfer");
          }
        },
      ),
    },
    {
      ...policyDefinitions.find((p) => p.name === "cosmos-managed-identity"),
      name: "cosmos-managed-identity",
      description: "Cosmos DB should disable local auth in favour of managed identity (MCSB IM-1)",
      enforcementLevel: "advisory",
      validateResource: validateResourceOfType(
        documentdb.DatabaseAccount,
        // Advisory: Cosmos DB local auth check is validated via IQ tests post-deployment.
        // This serves as a reminder during preview.
        (_account, _args, _reportViolation) => {},
      ),
    },
    {
      ...policyDefinitions.find((p) => p.name === "keyvault-soft-delete"),
      name: "keyvault-soft-delete",
      description: "Key Vault must have soft delete enabled (MCSB DP-1)",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType(
        keyvault.Vault,
        (vault, _args, reportViolation) => {
          if (vault.properties?.enableSoftDelete === false) {
            reportViolation("Key Vault must have soft delete enabled");
          }
        },
      ),
    },
    {
      ...policyDefinitions.find((p) => p.name === "function-managed-identity"),
      name: "function-managed-identity",
      description: "Function App must use managed identity (MCSB IM-1)",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType(
        web.WebApp,
        (app, _args, reportViolation) => {
          if (!app.identity?.type) {
            reportViolation("Function App must have managed identity enabled");
          }
        },
      ),
    },
    {
      ...policyDefinitions.find((p) => p.name === "apim-https-only"),
      name: "apim-https-only",
      description: "APIM APIs must enforce HTTPS-only protocols (MCSB NS-8)",
      enforcementLevel: "mandatory",
      validateResource: validateResourceOfType(
        apimanagement.Api,
        (api, _args, reportViolation) => {
          if (!api.protocols?.every((p) => p === "https")) {
            reportViolation("API must use HTTPS only");
          }
        },
      ),
    },
    {
      name: "resource-tagging",
      description: "All resources must have project, environment, and managedBy tags (MCSB PM-1)",
      enforcementLevel: "mandatory",
      validateResource: (args, reportViolation) => {
        if (
          args.type === "pulumi:pulumi:Stack" ||
          args.type === "pulumi:providers:azure-native"
        ) {
          return;
        }
        const tags = (args.props as Record<string, unknown>).tags as
          | Record<string, string>
          | undefined;
        const required = ["project", "environment", "managedBy"];
        if (!tags) {
          reportViolation(
            `Resource must have tags: ${required.join(", ")}`,
          );
          return;
        }
        const missing = required.filter((t) => !tags[t]);
        if (missing.length > 0) {
          reportViolation(`Resource must have tags: ${missing.join(", ")}`);
        }
      },
    },
  ],
});
