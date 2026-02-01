import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";
import {
  CDN_BASE_URL,
  DEFAULT_TTL,
  MAX_IMAGE_SIZE,
  SUPPORTED_CONTENT_TYPES,
} from "../../../src/shared/constants";

const POLICY_PATH = resolve(__dirname, "../../../policies/post-images.xml");

describe("policies/post-images.xml", () => {
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

  describe("request validation", () => {
    test("validates Content-Type against supported types", () => {
      for (const contentType of SUPPORTED_CONTENT_TYPES) {
        expect(xml).toContain(contentType);
      }
    });

    test("contains image/png in Content-Type check", () => {
      expect(xml).toContain("image/png");
    });

    test("contains image/jpeg in Content-Type check", () => {
      expect(xml).toContain("image/jpeg");
    });

    test("contains image/gif in Content-Type check", () => {
      expect(xml).toContain("image/gif");
    });

    test("contains image/webp in Content-Type check", () => {
      expect(xml).toContain("image/webp");
    });

    test("returns 400 for unsupported Content-Type", () => {
      expect(xml).toContain('code="400"');
    });

    test("returns 400 for empty body", () => {
      // Both empty body and bad content-type return 400
      const matches = xml.match(/code="400"/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    test("returns 413 for body exceeding size limit", () => {
      expect(xml).toContain('code="413"');
      expect(xml).toContain(String(MAX_IMAGE_SIZE));
    });
  });

  describe("hash computation", () => {
    test("contains SHA256 hash computation", () => {
      expect(xml).toContain("SHA256");
    });

    test("stores hash in context variable named hash", () => {
      expect(xml).toContain('name="hash"');
    });

    test("converts to base64url encoding", () => {
      expect(xml).toContain("Replace");
      expect(xml).toContain("+");
      expect(xml).toContain("-");
      expect(xml).toContain("_");
    });

    test("removes padding characters", () => {
      expect(xml).toContain("TrimEnd");
    });
  });

  describe("deduplication check", () => {
    test("sends GET request to Cosmos DB for existing document", () => {
      expect(xml).toContain("send-request");
      expect(xml).toContain("GET");
    });

    test("uses hash as document id and partition key", () => {
      expect(xml).toContain("x-ms-documentdb-partitionkey");
    });

    test("returns 201 with existing document when hash exists", () => {
      expect(xml).toContain('code="201"');
    });
  });

  describe("blob storage write", () => {
    test("sends PUT request to Blob Storage", () => {
      expect(xml).toContain("PUT");
    });

    test("sets blob type header", () => {
      expect(xml).toContain("x-ms-blob-type");
      expect(xml).toContain("BlockBlob");
    });

    test("passes through Content-Type to blob", () => {
      expect(xml).toContain("contentType");
    });
  });

  describe("cosmos document creation", () => {
    test("sends POST request to Cosmos DB", () => {
      expect(xml).toContain("POST");
    });

    test("document contains status field set to processing", () => {
      expect(xml).toContain('"processing"');
    });

    test("document contains ttl field matching DEFAULT_TTL", () => {
      expect(xml).toContain(String(DEFAULT_TTL));
    });

    test("document URL uses CDN base URL", () => {
      expect(xml).toContain(CDN_BASE_URL);
    });
  });

  describe("service bus queue", () => {
    test("sends message to image-metadata-extraction queue", () => {
      expect(xml).toContain("image-metadata-extraction");
    });

    test("message body contains hash field", () => {
      expect(xml).toContain('"hash"');
    });

    test("queue failure does not fail the request", () => {
      expect(xml).toContain('ignore-error="true"');
    });
  });

  describe("response construction", () => {
    test("returns 201 status code", () => {
      expect(xml).toContain('code="201"');
    });

    test("response body contains id field", () => {
      expect(xml).toContain('"id"');
    });

    test("response body contains url field", () => {
      expect(xml).toContain('"url"');
    });

    test("response body contains status field", () => {
      expect(xml).toContain('"status"');
    });

    test("response body contains size field", () => {
      expect(xml).toContain('"size"');
    });

    test("response body contains contentType field", () => {
      expect(xml).toContain('"contentType"');
    });

    test("response body contains createdAt field", () => {
      expect(xml).toContain('"createdAt"');
    });

    test("sets Content-Type response header to application/json", () => {
      expect(xml).toContain("application/json");
    });
  });

  describe("error handling", () => {
    test("on-error section contains error response", () => {
      const onError = xml.substring(xml.indexOf("<on-error>"));
      expect(onError).toContain("return-response");
    });

    test("on-error returns 500 for unhandled errors", () => {
      const onError = xml.substring(xml.indexOf("<on-error>"));
      expect(onError).toContain('code="500"');
    });
  });

  describe("authentication", () => {
    test("all send-request blocks use authentication-managed-identity", () => {
      const sendRequests = xml.match(/<send-request[\s\S]*?<\/send-request>/g);
      expect(sendRequests).not.toBeNull();
      expect(sendRequests!.length).toBeGreaterThanOrEqual(4);
      for (const block of sendRequests!) {
        expect(block).toContain("authentication-managed-identity");
      }
    });

    test("Cosmos DB requests use cosmos.azure.com resource", () => {
      expect(xml).toContain("https://cosmos.azure.com");
    });

    test("Blob Storage requests use storage.azure.com resource", () => {
      expect(xml).toContain("https://storage.azure.com");
    });

    test("Service Bus requests use servicebus.azure.net resource", () => {
      expect(xml).toContain("https://servicebus.azure.net");
    });
  });
});
