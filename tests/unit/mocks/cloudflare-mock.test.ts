import { beforeEach, describe, expect, test } from "bun:test";
import { CloudflarePurgeError } from "../../../src/shared/cloudflare-interface";
import { CloudflareClientMock } from "../../mocks/cloudflare-mock";

describe("CloudflareClientMock", () => {
  let client: CloudflareClientMock;
  const url = "https://img.lekman.com/abc123";

  beforeEach(() => {
    client = new CloudflareClientMock();
  });

  describe("purge", () => {
    test("records the purged URL", async () => {
      await client.purge(url);
      expect(client.getPurgeCalls()).toEqual([url]);
    });

    test("records multiple purge calls", async () => {
      await client.purge("https://img.lekman.com/a");
      await client.purge("https://img.lekman.com/b");
      expect(client.getPurgeCalls()).toEqual([
        "https://img.lekman.com/a",
        "https://img.lekman.com/b",
      ]);
    });
  });

  describe("getPurgeCalls", () => {
    test("returns empty array initially", () => {
      expect(client.getPurgeCalls()).toEqual([]);
    });

    test("returns a copy (not a reference)", async () => {
      await client.purge(url);
      const calls = client.getPurgeCalls();
      calls.push("tampered");
      expect(client.getPurgeCalls()).toEqual([url]);
    });
  });

  describe("failure simulation", () => {
    test("throws CloudflarePurgeError when shouldFail is true", async () => {
      client.setPurgeShouldFail(true);
      try {
        await client.purge(url);
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(CloudflarePurgeError);
        expect((err as CloudflarePurgeError).statusCode).toBe(500);
      }
    });

    test("throws with custom status code", async () => {
      client.setPurgeShouldFail(true, 403);
      try {
        await client.purge(url);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(CloudflarePurgeError);
        expect((err as CloudflarePurgeError).statusCode).toBe(403);
      }
    });
  });

  describe("clear", () => {
    test("resets purge calls and failure state", async () => {
      await client.purge(url);
      client.setPurgeShouldFail(true);
      client.clear();
      expect(client.getPurgeCalls()).toEqual([]);
      await client.purge(url);
      expect(client.getPurgeCalls()).toEqual([url]);
    });
  });
});

describe("CloudflarePurgeError", () => {
  test("has correct name and statusCode", () => {
    const error = new CloudflarePurgeError("purge failed", 502);
    expect(error.name).toBe("CloudflarePurgeError");
    expect(error.message).toBe("purge failed");
    expect(error.statusCode).toBe(502);
    expect(error).toBeInstanceOf(Error);
  });
});
