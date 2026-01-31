import { describe, expect, test } from "bun:test";
import type {
  CreateImageInput,
  DeleteResult,
  ExifData,
  ImageDocument,
  MetadataResult,
} from "../../../src/shared/types";
import { isExifData, isImageDocument, isValidStatus } from "../../../src/shared/types";

describe("isValidStatus", () => {
  test("returns true for 'processing'", () => {
    expect(isValidStatus("processing")).toBe(true);
  });

  test("returns true for 'ready'", () => {
    expect(isValidStatus("ready")).toBe(true);
  });

  test("returns true for 'failed'", () => {
    expect(isValidStatus("failed")).toBe(true);
  });

  test("returns false for invalid status string", () => {
    expect(isValidStatus("unknown")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidStatus("")).toBe(false);
  });

  test("returns false for non-string values", () => {
    expect(isValidStatus(null)).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
    expect(isValidStatus(42)).toBe(false);
    expect(isValidStatus({})).toBe(false);
  });
});

describe("isExifData", () => {
  test("returns true for valid ExifData with all fields populated", () => {
    const exif: ExifData = {
      created: "2026-01-01T00:00:00Z",
      location: { lat: 59.3293, lon: 18.0686 },
      camera: "Canon EOS R5",
    };
    expect(isExifData(exif)).toBe(true);
  });

  test("returns true for ExifData with all nullable fields set to null", () => {
    const exif: ExifData = {
      created: null,
      location: null,
      camera: null,
    };
    expect(isExifData(exif)).toBe(true);
  });

  test("returns false for null", () => {
    expect(isExifData(null)).toBe(false);
  });

  test("returns false for non-object", () => {
    expect(isExifData("string")).toBe(false);
    expect(isExifData(42)).toBe(false);
  });

  test("returns false when required keys are missing", () => {
    expect(isExifData({})).toBe(false);
    expect(isExifData({ created: null })).toBe(false);
    expect(isExifData({ created: null, location: null })).toBe(false);
  });

  test("returns false when created is wrong type", () => {
    expect(isExifData({ created: 123, location: null, camera: null })).toBe(false);
  });

  test("returns false when camera is wrong type", () => {
    expect(isExifData({ created: null, location: null, camera: 123 })).toBe(false);
  });

  test("returns false when location has wrong shape", () => {
    expect(isExifData({ created: null, location: "bad", camera: null })).toBe(false);
    expect(
      isExifData({
        created: null,
        location: { lat: "bad", lon: 1 },
        camera: null,
      })
    ).toBe(false);
    expect(
      isExifData({
        created: null,
        location: { lat: 1, lon: "bad" },
        camera: null,
      })
    ).toBe(false);
  });
});

describe("isImageDocument", () => {
  const validDoc: ImageDocument = {
    id: "abc123",
    url: "https://img.lekman.com/abc123",
    status: "processing",
    size: 1024,
    contentType: "image/png",
    width: null,
    height: null,
    exif: null,
    createdAt: "2026-01-31T00:00:00Z",
    ttl: 604800,
  };

  test("returns true for a valid document with nullable fields as null", () => {
    expect(isImageDocument(validDoc)).toBe(true);
  });

  test("returns true for a valid document with all fields populated", () => {
    const fullDoc: ImageDocument = {
      ...validDoc,
      status: "ready",
      width: 1920,
      height: 1080,
      exif: { created: "2026-01-01T00:00:00Z", location: null, camera: null },
    };
    expect(isImageDocument(fullDoc)).toBe(true);
  });

  test("returns false for null", () => {
    expect(isImageDocument(null)).toBe(false);
  });

  test("returns false for non-object", () => {
    expect(isImageDocument("string")).toBe(false);
  });

  test("returns false when id is missing", () => {
    const { id: _, ...noId } = validDoc;
    expect(isImageDocument(noId)).toBe(false);
  });

  test("returns false when status is invalid", () => {
    expect(isImageDocument({ ...validDoc, status: "invalid" })).toBe(false);
  });

  test("returns false when size is not a number", () => {
    expect(isImageDocument({ ...validDoc, size: "big" })).toBe(false);
  });

  test("returns false when width is wrong type", () => {
    expect(isImageDocument({ ...validDoc, width: "wide" })).toBe(false);
  });

  test("returns false when height is wrong type", () => {
    expect(isImageDocument({ ...validDoc, height: "tall" })).toBe(false);
  });

  test("returns false when exif is invalid object", () => {
    expect(isImageDocument({ ...validDoc, exif: { bad: true } })).toBe(false);
  });

  test("returns false when createdAt is not a string", () => {
    expect(isImageDocument({ ...validDoc, createdAt: 12345 })).toBe(false);
  });

  test("returns false when ttl is not a number", () => {
    expect(isImageDocument({ ...validDoc, ttl: "forever" })).toBe(false);
  });
});

describe("type compilation checks", () => {
  test("DeleteResult accepts status and optional error", () => {
    const withError: DeleteResult = { status: 502, error: "Cloudflare failed" };
    const withoutError: DeleteResult = { status: 204 };
    expect(withError.status).toBe(502);
    expect(withError.error).toBe("Cloudflare failed");
    expect(withoutError.status).toBe(204);
    expect(withoutError.error).toBeUndefined();
  });

  test("MetadataResult has width, height, and nullable exif", () => {
    const result: MetadataResult = {
      width: 1920,
      height: 1080,
      exif: null,
    };
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.exif).toBeNull();
  });

  test("CreateImageInput has hash, size, and contentType", () => {
    const input: CreateImageInput = {
      hash: "abc123",
      size: 1024,
      contentType: "image/png",
    };
    expect(input.hash).toBe("abc123");
    expect(input.size).toBe(1024);
    expect(input.contentType).toBe("image/png");
  });
});
