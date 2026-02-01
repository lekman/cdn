/**
 * Unit: CrossGuard policy definition tests.
 * Validates the pure policy data used by the PolicyPack.
 */

import { describe, expect, test } from "bun:test";
import { policyDefinitions } from "../../../infra/security/policy-pack/policies";

describe("Unit: CrossGuard policy definitions", () => {
  test("defines 7 policies", () => {
    expect(policyDefinitions).toHaveLength(7);
  });

  test("no duplicate policy names", () => {
    const names = policyDefinitions.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("all policies have required fields", () => {
    for (const policy of policyDefinitions) {
      expect(policy.name).toBeTruthy();
      expect(policy.description).toBeTruthy();
      expect(["advisory", "mandatory", "disabled"]).toContain(policy.enforcementLevel);
      expect(policy.mcsbControl).toBeTruthy();
      expect(policy.resourceType).toBeTruthy();
    }
  });

  test("mandatory policies include storage-tls-required", () => {
    const policy = policyDefinitions.find((p) => p.name === "storage-tls-required");
    expect(policy).toBeDefined();
    expect(policy?.enforcementLevel).toBe("mandatory");
    expect(policy?.mcsbControl).toBe("DP-3");
  });

  test("mandatory policies include storage-https-transfer", () => {
    const policy = policyDefinitions.find((p) => p.name === "storage-https-transfer");
    expect(policy).toBeDefined();
    expect(policy?.enforcementLevel).toBe("mandatory");
  });

  test("mandatory policies include keyvault-soft-delete", () => {
    const policy = policyDefinitions.find((p) => p.name === "keyvault-soft-delete");
    expect(policy).toBeDefined();
    expect(policy?.enforcementLevel).toBe("mandatory");
    expect(policy?.mcsbControl).toBe("DP-1");
  });

  test("mandatory policies include function-managed-identity", () => {
    const policy = policyDefinitions.find((p) => p.name === "function-managed-identity");
    expect(policy).toBeDefined();
    expect(policy?.enforcementLevel).toBe("mandatory");
    expect(policy?.mcsbControl).toBe("IM-1");
  });

  test("mandatory policies include apim-https-only", () => {
    const policy = policyDefinitions.find((p) => p.name === "apim-https-only");
    expect(policy).toBeDefined();
    expect(policy?.enforcementLevel).toBe("mandatory");
    expect(policy?.mcsbControl).toBe("NS-8");
  });

  test("mandatory policies include resource-tagging", () => {
    const policy = policyDefinitions.find((p) => p.name === "resource-tagging");
    expect(policy).toBeDefined();
    expect(policy?.enforcementLevel).toBe("mandatory");
    expect(policy?.resourceType).toBe("*");
  });

  test("advisory policies include cosmos-managed-identity", () => {
    const policy = policyDefinitions.find((p) => p.name === "cosmos-managed-identity");
    expect(policy).toBeDefined();
    expect(policy?.enforcementLevel).toBe("advisory");
  });
});
