/**
 * Unit: Infrastructure specification tests.
 * Validates environment-specific resource naming and configuration.
 */

import { describe, expect, test } from "bun:test";
import { createSpec } from "../../../infra/specification";

const dev = createSpec("dev");
const prod = createSpec("prod");

describe("Unit: Specification - environment values", () => {
  test("dev environment is 'dev'", () => {
    expect(dev.environment).toBe("dev");
  });

  test("prod environment is 'prod'", () => {
    expect(prod.environment).toBe("prod");
  });

  test("both use uksouth location", () => {
    expect(dev.location).toBe("uksouth");
    expect(prod.location).toBe("uksouth");
  });
});

describe("Unit: Specification - tags", () => {
  test("dev has correct tags", () => {
    expect(dev.tags).toEqual({
      project: "cdn",
      environment: "dev",
      managedBy: "pulumi",
    });
  });

  test("prod has correct tags", () => {
    expect(prod.tags).toEqual({
      project: "cdn",
      environment: "prod",
      managedBy: "pulumi",
    });
  });
});

describe("Unit: Specification - storage", () => {
  test("dev storage account uses CAF prefix st", () => {
    expect(dev.storage.accountName).toBe("stcdndevuksouth001");
  });

  test("prod storage account uses CAF prefix st", () => {
    expect(prod.storage.accountName).toBe("stcdnproduksouth001");
  });

  test("container name is images", () => {
    expect(dev.storage.containerName).toBe("images");
    expect(prod.storage.containerName).toBe("images");
  });

  test("SKU is Standard_LRS", () => {
    expect(dev.storage.skuName).toBe("Standard_LRS");
  });

  test("lifecycle is 7 days", () => {
    expect(dev.storage.lifecycleDays).toBe(7);
  });
});

describe("Unit: Specification - Cosmos DB", () => {
  test("dev account uses CAF prefix cosmos", () => {
    expect(dev.cosmosDb.accountName).toBe("cosmos-cdn-dev-uksouth-001");
  });

  test("prod account uses CAF prefix cosmos", () => {
    expect(prod.cosmosDb.accountName).toBe("cosmos-cdn-prod-uksouth-001");
  });

  test("database name is cdn", () => {
    expect(dev.cosmosDb.databaseName).toBe("cdn");
  });

  test("container name is images", () => {
    expect(dev.cosmosDb.containerName).toBe("images");
  });

  test("partition key is /id", () => {
    expect(dev.cosmosDb.partitionKeyPath).toBe("/id");
  });
});

describe("Unit: Specification - Service Bus", () => {
  test("queue name is image-metadata-extraction", () => {
    expect(dev.serviceBus.queueName).toBe("image-metadata-extraction");
  });

  test("message TTL is 1 hour", () => {
    expect(dev.serviceBus.messageTtl).toBe("PT1H");
  });

  test("max delivery count is 1 (no retry)", () => {
    expect(dev.serviceBus.maxDeliveryCount).toBe(1);
  });
});

describe("Unit: Specification - Function App", () => {
  test("dev app uses CAF prefix func", () => {
    expect(dev.functionApp.appName).toBe("func-cdn-dev-uksouth-001");
  });

  test("prod app uses CAF prefix func", () => {
    expect(prod.functionApp.appName).toBe("func-cdn-prod-uksouth-001");
  });

  test("dev plan uses Azure auto-managed consumption plan name", () => {
    expect(dev.functionApp.planName).toBe("UKSouthLinuxDynamicPlan");
  });

  test("runtime is node", () => {
    expect(dev.functionApp.runtime).toBe("node");
  });
});

describe("Unit: Specification - Key Vault", () => {
  test("dev vault uses CAF prefix kv", () => {
    expect(dev.keyVault.vaultName).toBe("kv-cdn-dev-uksouth-001");
  });

  test("prod vault uses CAF prefix kv", () => {
    expect(prod.keyVault.vaultName).toBe("kv-cdn-prod-uksouth-001");
  });

  test("secret name is cloudflare-api-token", () => {
    expect(dev.keyVault.secretName).toBe("cloudflare-api-token");
  });
});

describe("Unit: Specification - APIM", () => {
  test("api path is cdn/v1", () => {
    expect(dev.apim.apiPath).toBe("cdn/v1");
  });

  test("dev api name contains dev", () => {
    expect(dev.apim.apiName).toContain("dev");
  });

  test("prod api name contains prod", () => {
    expect(prod.apim.apiName).toContain("prod");
  });
});

describe("Unit: Specification - resource group", () => {
  test("dev resource group uses CAF prefix rg", () => {
    expect(dev.resourceGroup.name).toBe("rg-cdn-dev-uksouth-001");
  });

  test("prod resource group uses CAF prefix rg", () => {
    expect(prod.resourceGroup.name).toBe("rg-cdn-prod-uksouth-001");
  });
});

describe("Unit: Specification - stack reference", () => {
  test("dev references lekman/rag-infra/dev", () => {
    expect(dev.ragInfraStack).toBe("lekman/rag-infra/dev");
  });

  test("prod references lekman/rag-infra/prod", () => {
    expect(prod.ragInfraStack).toBe("lekman/rag-infra/prod");
  });
});
