import { beforeEach, describe, expect, test } from "bun:test";
import { CosmosClientMock } from "../../mocks/cosmos-mock";
import type { ImageDocument } from "../../../src/shared/types";

const makeDoc = (id: string): ImageDocument => ({
  id,
  url: `https://img.lekman.com/${id}`,
  status: "processing",
  size: 1024,
  contentType: "image/png",
  width: null,
  height: null,
  exif: null,
  createdAt: "2026-01-31T00:00:00Z",
  ttl: 604800,
});

describe("CosmosClientMock", () => {
  let client: CosmosClientMock;

  beforeEach(() => {
    client = new CosmosClientMock();
  });

  describe("read", () => {
    test("returns null for missing document", async () => {
      expect(await client.read("nonexistent")).toBeNull();
    });

    test("returns document after create", async () => {
      const doc = makeDoc("abc");
      await client.create(doc);
      expect(await client.read("abc")).toEqual(doc);
    });

    test("returns document set via setDocument", async () => {
      const doc = makeDoc("preset");
      client.setDocument(doc);
      expect(await client.read("preset")).toEqual(doc);
    });
  });

  describe("create", () => {
    test("stores and returns the document", async () => {
      const doc = makeDoc("new");
      const result = await client.create(doc);
      expect(result).toEqual(doc);
    });
  });

  describe("update", () => {
    test("merges partial updates", async () => {
      const doc = makeDoc("upd");
      await client.create(doc);
      const updated = await client.update("upd", {
        status: "ready",
        width: 1920,
      });
      expect(updated.status).toBe("ready");
      expect(updated.width).toBe(1920);
      expect(updated.id).toBe("upd");
    });

    test("throws for missing document", async () => {
      expect(client.update("missing", { status: "ready" })).rejects.toThrow(
        "not found",
      );
    });
  });

  describe("delete", () => {
    test("removes document", async () => {
      await client.create(makeDoc("del"));
      await client.delete("del");
      expect(await client.read("del")).toBeNull();
    });
  });

  describe("failure simulation", () => {
    test("read throws when shouldFail is true", async () => {
      client.setShouldFail(true);
      expect(client.read("any")).rejects.toThrow("simulated failure");
    });

    test("create throws when shouldFail is true", async () => {
      client.setShouldFail(true);
      expect(client.create(makeDoc("fail"))).rejects.toThrow(
        "simulated failure",
      );
    });

    test("update throws when shouldFail is true", async () => {
      await client.create(makeDoc("upd"));
      client.setShouldFail(true);
      expect(client.update("upd", {})).rejects.toThrow("simulated failure");
    });

    test("delete throws when shouldFail is true", async () => {
      client.setShouldFail(true);
      expect(client.delete("any")).rejects.toThrow("simulated failure");
    });
  });

  describe("clear", () => {
    test("removes all documents and resets failure state", async () => {
      await client.create(makeDoc("a"));
      client.setShouldFail(true);
      client.clear();
      expect(await client.read("a")).toBeNull();
    });
  });
});
