import { describe, expect, test } from "bun:test";
import type { ExtractionMessage } from "../../../../src/functions/metadata-extraction/handler";
import { extractMetadata } from "../../../../src/functions/metadata-extraction/handler";
import type { ImageDocument } from "../../../../src/shared/types";
import { BlobClientMock } from "../../../mocks/blob-mock";
import { CosmosClientMock } from "../../../mocks/cosmos-mock";

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

const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEFTkSuQmCC",
  "base64"
);

describe("extractMetadata", () => {
  test("reads blob by hash and updates Cosmos with ready status", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    blob.setBlob("abc123", VALID_PNG, "image/png");
    cosmos.setDocument(makeDoc("abc123"));

    await extractMetadata({ hash: "abc123" }, { cosmos, blob });

    const doc = await cosmos.read("abc123");
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("ready");
    expect(doc!.width).toBe(1);
    expect(doc!.height).toBe(1);
    expect(doc!.exif).toBeNull();
  });

  test("sets status to failed when blob is not found", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    cosmos.setDocument(makeDoc("abc123"));

    await extractMetadata({ hash: "abc123" }, { cosmos, blob });

    const doc = await cosmos.read("abc123");
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("failed");
  });

  test("sets status to failed when blob data is corrupted", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    blob.setBlob("abc123", Buffer.from([0xff, 0x00, 0x42, 0x99]), "image/png");
    cosmos.setDocument(makeDoc("abc123"));

    await extractMetadata({ hash: "abc123" }, { cosmos, blob });

    const doc = await cosmos.read("abc123");
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("failed");
  });

  test("does not throw on failure", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    blob.setShouldFail(true);
    cosmos.setDocument(makeDoc("abc123"));

    await expect(extractMetadata({ hash: "abc123" }, { cosmos, blob })).resolves.toBeUndefined();
  });

  test("handles invalid message without hash", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    cosmos.setDocument(makeDoc("abc123"));

    await expect(
      extractMetadata({} as ExtractionMessage, { cosmos, blob })
    ).resolves.toBeUndefined();

    const doc = await cosmos.read("abc123");
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe("processing");
  });

  test("handles empty hash string", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();

    await expect(extractMetadata({ hash: "" }, { cosmos, blob })).resolves.toBeUndefined();
  });

  test("swallows error when Cosmos update for failed status also fails", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    blob.setShouldFail(true);
    cosmos.setShouldFail(true);

    await expect(extractMetadata({ hash: "abc123" }, { cosmos, blob })).resolves.toBeUndefined();
  });

  test("completes without hanging promises", async () => {
    const blob = new BlobClientMock();
    const cosmos = new CosmosClientMock();
    blob.setBlob("abc123", VALID_PNG, "image/png");
    cosmos.setDocument(makeDoc("abc123"));

    const promise = extractMetadata({ hash: "abc123" }, { cosmos, blob });
    await expect(promise).resolves.toBeUndefined();
  });
});
