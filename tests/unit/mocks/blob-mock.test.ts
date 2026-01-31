import { beforeEach, describe, expect, test } from "bun:test";
import { BlobClientMock } from "../../mocks/blob-mock";

describe("BlobClientMock", () => {
  let client: BlobClientMock;
  const hash = "n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg";
  const data = Buffer.from("image data");
  const contentType = "image/png";

  beforeEach(() => {
    client = new BlobClientMock();
  });

  describe("write and read", () => {
    test("stores and retrieves blob data", async () => {
      await client.write(hash, data, contentType);
      const result = await client.read(hash);
      expect(result).toEqual(data);
    });
  });

  describe("read", () => {
    test("throws for missing blob", async () => {
      expect(client.read("nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("exists", () => {
    test("returns false for missing blob", async () => {
      expect(await client.exists("nonexistent")).toBe(false);
    });

    test("returns true after write", async () => {
      await client.write(hash, data, contentType);
      expect(await client.exists(hash)).toBe(true);
    });
  });

  describe("delete", () => {
    test("removes blob", async () => {
      await client.write(hash, data, contentType);
      await client.delete(hash);
      expect(await client.exists(hash)).toBe(false);
    });
  });

  describe("setBlob", () => {
    test("pre-populates blob for testing", async () => {
      client.setBlob(hash, data, contentType);
      expect(await client.exists(hash)).toBe(true);
      expect(await client.read(hash)).toEqual(data);
    });
  });

  describe("failure simulation", () => {
    test("write throws when shouldFail is true", async () => {
      client.setShouldFail(true);
      expect(client.write(hash, data, contentType)).rejects.toThrow(
        "simulated failure",
      );
    });

    test("read throws when shouldFail is true", async () => {
      client.setShouldFail(true);
      expect(client.read(hash)).rejects.toThrow("simulated failure");
    });

    test("delete throws when shouldFail is true", async () => {
      client.setShouldFail(true);
      expect(client.delete(hash)).rejects.toThrow("simulated failure");
    });

    test("exists throws when shouldFail is true", async () => {
      client.setShouldFail(true);
      expect(client.exists(hash)).rejects.toThrow("simulated failure");
    });
  });

  describe("clear", () => {
    test("removes all blobs and resets failure state", async () => {
      await client.write(hash, data, contentType);
      client.setShouldFail(true);
      client.clear();
      expect(await client.exists(hash)).toBe(false);
    });
  });
});
