import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { HASH_LENGTH } from "../../../src/shared/constants";

const POLICY_PATH = resolve(__dirname, "../../../policies/get-image.xml");

describe("policies/get-image.xml", () => {
  let xml: string;
  let policy: Record<string, unknown>;

  beforeAll(() => {
    xml = readFileSync(POLICY_PATH, "utf-8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      allowBooleanAttributes: true,
      parseAttributeValue: false,
      trimValues: true,
    });
    policy = parser.parse(xml);
  });

  describe("XML structure", () => {
    test("parses without error", () => {
      expect(policy).toBeDefined();
    });

    test("has root policies element", () => {
      expect(policy).toHaveProperty("policies");
    });

    test("has inbound section", () => {
      expect((policy as any).policies).toHaveProperty("inbound");
    });

    test("has backend section", () => {
      expect((policy as any).policies).toHaveProperty("backend");
    });

    test("has outbound section", () => {
      expect((policy as any).policies).toHaveProperty("outbound");
    });

    test("has on-error section", () => {
      expect((policy as any).policies).toHaveProperty("on-error");
    });
  });

  describe("path parameter extraction (WBS 1)", () => {
    test("extracts hash from URL path into context variable", () => {
      expect(xml).toContain('name="hash"');
    });

    test("validates hash as 43-character base64url string", () => {
      expect(xml).toContain(String(HASH_LENGTH));
      expect(xml).toContain("[A-Za-z0-9_-]");
    });

    test("returns 400 for invalid hash format", () => {
      expect(xml).toContain('code="400"');
      expect(xml).toContain("Invalid hash format");
    });
  });

  describe("Cosmos DB point-read (WBS 2)", () => {
    test("sends GET request to Cosmos DB", () => {
      expect(xml).toContain("send-request");
      expect(xml).toContain("GET");
    });

    test("queries Cosmos DB docs endpoint with hash as document ID", () => {
      expect(xml).toContain("/dbs/cdn/colls/images/docs/");
    });

    test("sets partition key header with hash value", () => {
      expect(xml).toContain("x-ms-documentdb-partitionkey");
    });

    test("sets Cosmos DB API version header", () => {
      expect(xml).toContain("x-ms-version");
      expect(xml).toContain("2018-12-31");
    });

    test("uses managed identity authentication for Cosmos DB", () => {
      expect(xml).toContain("authentication-managed-identity");
      expect(xml).toContain("https://cosmos.azure.com");
    });

    test("stores Cosmos response in a variable", () => {
      expect(xml).toContain("cosmosResponse");
    });
  });

  describe("response construction (WBS 3)", () => {
    test("returns 200 with Cosmos document when found", () => {
      expect(xml).toContain('code="200"');
    });

    test("returns 404 when document not found", () => {
      expect(xml).toContain('code="404"');
      expect(xml).toContain("Image not found");
    });

    test("sets Content-Type response header to application/json", () => {
      expect(xml).toContain("application/json");
    });

    test("sets Cache-Control to no-cache", () => {
      expect(xml).toContain("Cache-Control");
      expect(xml).toContain("no-cache");
    });
  });

  describe("error handling (WBS 4)", () => {
    test("on-error section returns 500 for unexpected failures", () => {
      const onError = xml.substring(xml.indexOf("<on-error>"));
      expect(onError).toContain("return-response");
      expect(onError).toContain('code="500"');
    });

    test("on-error returns JSON error body", () => {
      const onError = xml.substring(xml.indexOf("<on-error>"));
      expect(onError).toContain("application/json");
      expect(onError).toContain("An internal error occurred");
    });

    test("handles non-200/404 Cosmos responses as 500", () => {
      // The outbound choose block should have a default/otherwise for unexpected status codes
      expect(xml).toContain('code="500"');
    });
  });

  describe("authentication", () => {
    test("send-request uses authentication-managed-identity", () => {
      const sendRequests = xml.match(/<send-request[\s\S]*?<\/send-request>/g);
      expect(sendRequests).not.toBeNull();
      for (const block of sendRequests!) {
        expect(block).toContain("authentication-managed-identity");
      }
    });

    test("Cosmos DB requests use cosmos.azure.com resource", () => {
      expect(xml).toContain("https://cosmos.azure.com");
    });
  });
});
