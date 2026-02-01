/**
 * Unit: CDN stack resource configuration tests.
 * Tests pure config functions with both dev and prod specs.
 */

import { describe, expect, test } from "bun:test";
import {
  appServicePlanConfig,
  blobContainerConfig,
  cdnApiConfig,
  cosmosAccountConfig,
  cosmosContainerConfig,
  cosmosDatabaseConfig,
  functionAppConfig,
  keyVaultConfig,
  keyVaultSecretConfig,
  lifecyclePolicyConfig,
  ROLE_DEFINITIONS,
  serviceBusQueueConfig,
  storageAccountConfig,
} from "../../../infra/cdn/configs";
import { createSpec } from "../../../infra/specification";

const dev = createSpec("dev");
const prod = createSpec("prod");

describe("Unit: CDN stack - Storage Account config", () => {
  for (const [name, spec] of [
    ["dev", dev],
    ["prod", prod],
  ] as const) {
    describe(name, () => {
      const config = storageAccountConfig(spec);

      test("uses specification account name", () => {
        expect(config.accountName).toBe(spec.storage.accountName);
      });

      test("kind is StorageV2", () => {
        expect(config.kind).toBe("StorageV2");
      });

      test("SKU matches specification", () => {
        expect(config.sku.name).toBe(spec.storage.skuName);
      });

      test("access tier is Hot", () => {
        expect(config.accessTier).toBe("Hot");
      });

      test("allows blob public access", () => {
        expect(config.allowBlobPublicAccess).toBe(true);
      });

      test("minimum TLS is 1.2", () => {
        expect(config.minimumTlsVersion).toBe("TLS1_2");
      });

      test("has project tags", () => {
        expect(config.tags).toEqual(spec.tags);
      });
    });
  }
});

describe("Unit: CDN stack - Blob Container config", () => {
  const config = blobContainerConfig(dev);

  test("container name is images", () => {
    expect(config.containerName).toBe("images");
  });

  test("public access is Blob", () => {
    expect(config.publicAccess).toBe("Blob");
  });
});

describe("Unit: CDN stack - Lifecycle Policy config", () => {
  const config = lifecyclePolicyConfig(dev);

  test("deletes after 7 days", () => {
    expect(config.daysAfterCreation).toBe(7);
  });

  test("targets blockBlob type", () => {
    expect(config.blobTypes).toEqual(["blockBlob"]);
  });

  test("prefix matches images container", () => {
    expect(config.prefixMatch).toEqual(["images/"]);
  });
});

describe("Unit: CDN stack - Cosmos DB Account config", () => {
  for (const [name, spec] of [
    ["dev", dev],
    ["prod", prod],
  ] as const) {
    describe(name, () => {
      const config = cosmosAccountConfig(spec);

      test("uses specification account name", () => {
        expect(config.accountName).toBe(spec.cosmosDb.accountName);
      });

      test("offer type is Standard", () => {
        expect(config.databaseAccountOfferType).toBe("Standard");
      });

      test("has EnableServerless capability", () => {
        expect(config.capabilities).toEqual([{ name: "EnableServerless" }]);
      });

      test("consistency level is Session", () => {
        expect(config.consistencyPolicy.defaultConsistencyLevel).toBe("Session");
      });

      test("has project tags", () => {
        expect(config.tags).toEqual(spec.tags);
      });
    });
  }
});

describe("Unit: CDN stack - Cosmos Database config", () => {
  test("database name is cdn", () => {
    expect(cosmosDatabaseConfig(dev).databaseName).toBe("cdn");
  });
});

describe("Unit: CDN stack - Cosmos Container config", () => {
  const config = cosmosContainerConfig(dev);

  test("container name is images", () => {
    expect(config.containerName).toBe("images");
  });

  test("partition key path is /id with Hash kind", () => {
    expect(config.partitionKey).toEqual({
      paths: ["/id"],
      kind: "Hash",
    });
  });

  test("TTL is enabled (value -1 means per-document)", () => {
    expect(config.defaultTtl).toBe(-1);
  });
});

describe("Unit: CDN stack - Service Bus Queue config", () => {
  const config = serviceBusQueueConfig(dev);

  test("queue name is image-metadata-extraction", () => {
    expect(config.queueName).toBe("image-metadata-extraction");
  });

  test("message TTL is 1 hour (ISO 8601)", () => {
    expect(config.defaultMessageTimeToLive).toBe("PT1H");
  });

  test("max delivery count is 1 (no retry)", () => {
    expect(config.maxDeliveryCount).toBe(1);
  });

  test("dead lettering on expiration is disabled", () => {
    expect(config.deadLetteringOnMessageExpiration).toBe(false);
  });
});

describe("Unit: CDN stack - App Service Plan config", () => {
  for (const [name, spec] of [
    ["dev", dev],
    ["prod", prod],
  ] as const) {
    describe(name, () => {
      const config = appServicePlanConfig(spec);

      test("SKU is Y1 Dynamic (Consumption)", () => {
        expect(config.sku).toEqual({ name: "Y1", tier: "Dynamic" });
      });

      test("reserved is true (Linux)", () => {
        expect(config.reserved).toBe(true);
      });

      test("has project tags", () => {
        expect(config.tags).toEqual(spec.tags);
      });
    });
  }
});

describe("Unit: CDN stack - Function App config", () => {
  for (const [name, spec] of [
    ["dev", dev],
    ["prod", prod],
  ] as const) {
    describe(name, () => {
      const config = functionAppConfig(spec);

      test("uses specification app name", () => {
        expect(config.name).toBe(spec.functionApp.appName);
      });

      test("kind is functionapp,linux", () => {
        expect(config.kind).toBe("functionapp,linux");
      });

      test("has SystemAssigned managed identity", () => {
        expect(config.identity).toEqual({ type: "SystemAssigned" });
      });

      test("has project tags", () => {
        expect(config.tags).toEqual(spec.tags);
      });
    });
  }
});

describe("Unit: CDN stack - Key Vault config", () => {
  for (const [name, spec] of [
    ["dev", dev],
    ["prod", prod],
  ] as const) {
    describe(name, () => {
      const config = keyVaultConfig(spec);

      test("uses specification vault name", () => {
        expect(config.vaultName).toBe(spec.keyVault.vaultName);
      });

      test("SKU is standard", () => {
        expect(config.sku).toEqual({ family: "A", name: "standard" });
      });

      test("soft delete is enabled", () => {
        expect(config.enableSoftDelete).toBe(true);
      });

      test("retention is 90 days", () => {
        expect(config.softDeleteRetentionInDays).toBe(90);
      });

      test("has project tags", () => {
        expect(config.tags).toEqual(spec.tags);
      });
    });
  }
});

describe("Unit: CDN stack - Key Vault Secret config", () => {
  test("secret name is cloudflare-api-token", () => {
    expect(keyVaultSecretConfig(dev).secretName).toBe("cloudflare-api-token");
  });
});

describe("Unit: CDN stack - CDN API config", () => {
  for (const [name, spec] of [
    ["dev", dev],
    ["prod", prod],
  ] as const) {
    describe(name, () => {
      const config = cdnApiConfig(spec);

      test("api ID matches specification", () => {
        expect(config.apiId).toBe(spec.apim.apiName);
      });

      test("path is cdn/v1", () => {
        expect(config.path).toBe("cdn/v1");
      });

      test("protocols includes https", () => {
        expect(config.protocols).toEqual(["https"]);
      });
    });
  }
});

describe("Unit: CDN stack - RBAC Role Definitions", () => {
  test("has Storage Blob Data Contributor role ID", () => {
    expect(ROLE_DEFINITIONS.storageBlobDataContributor).toBeDefined();
  });

  test("has Service Bus Data Receiver role ID", () => {
    expect(ROLE_DEFINITIONS.serviceBusDataReceiver).toBeDefined();
  });

  test("has Service Bus Data Sender role ID", () => {
    expect(ROLE_DEFINITIONS.serviceBusDataSender).toBeDefined();
  });

  test("has Key Vault Secrets User role ID", () => {
    expect(ROLE_DEFINITIONS.keyVaultSecretsUser).toBeDefined();
  });
});
