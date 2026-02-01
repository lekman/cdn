import { describe, expect, test } from "bun:test";
import { handleDelete } from "../../../../src/functions/delete/handler";
import { CDN_BASE_URL } from "../../../../src/shared/constants";
import type { ImageDocument } from "../../../../src/shared/types";
import { BlobClientMock } from "../../../mocks/blob-mock";
import { CloudflareClientMock } from "../../../mocks/cloudflare-mock";
import { CosmosClientMock } from "../../../mocks/cosmos-mock";

const TEST_HASH = "LCa0a2j_xo_5m0U8HTBBNBNCLXBkg7-g-YpeiGJm564";

const makeDoc = (id: string): ImageDocument => ({
  id,
  url: `${CDN_BASE_URL}/${id}`,
  status: "processing",
  size: 1024,
  contentType: "image/png",
  width: null,
  height: null,
  exif: null,
  createdAt: "2026-01-31T00:00:00Z",
  ttl: 604800,
});

describe("handleDelete", () => {
  test("returns 204 when all three operations succeed", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();

    const result = await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    expect(result.status).toBe(204);
  });

  test("calls blob.delete with correct hash", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();
    blob.setBlob(TEST_HASH, Buffer.from("test"), "image/png");

    await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    expect(await blob.exists(TEST_HASH)).toBe(false);
  });

  test("calls cosmos.delete with correct hash", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();
    cosmos.setDocument(makeDoc(TEST_HASH));

    await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    const doc = await cosmos.read(TEST_HASH);
    expect(doc).toBeNull();
  });

  test("calls cloudflare.purge with correct URL", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();

    await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    const calls = cloudflare.getPurgeCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(`https://img.lekman.com/${TEST_HASH}`);
  });

  test("returns 204 when blob is not found", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();

    // Override delete to throw "not found" like Azure Blob Storage does for missing blobs
    blob.delete = async () => {
      throw new Error("BlobNotFound: blob not found");
    };

    const result = await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    expect(result.status).toBe(204);
  });

  test("returns 204 when cosmos document is not found", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();

    // Override delete to throw "not found" like Cosmos DB does for missing documents
    cosmos.delete = async () => {
      throw new Error("Entity with the specified id does not exist: not found");
    };

    const result = await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    expect(result.status).toBe(204);
  });

  test("returns 502 when Cloudflare purge fails", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();
    cloudflare.setPurgeShouldFail(true);

    const result = await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    expect(result.status).toBe(502);
    expect(result.error).toBeDefined();
  });

  test("blob and cosmos are still deleted when Cloudflare fails", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();
    blob.setBlob(TEST_HASH, Buffer.from("test"), "image/png");
    cosmos.setDocument(makeDoc(TEST_HASH));
    cloudflare.setPurgeShouldFail(true);

    await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    expect(await blob.exists(TEST_HASH)).toBe(false);
    const doc = await cosmos.read(TEST_HASH);
    expect(doc).toBeNull();
  });

  test("cloudflare purge URL uses CDN_BASE_URL", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    const cloudflare = new CloudflareClientMock();

    await handleDelete(TEST_HASH, { cosmos, blob, cloudflare });

    const calls = cloudflare.getPurgeCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(`${CDN_BASE_URL}/${TEST_HASH}`);
  });
});
