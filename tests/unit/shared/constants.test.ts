import { describe, expect, test } from "bun:test";
import {
  CDN_BASE_URL,
  DEFAULT_TTL,
  HASH_LENGTH,
  MAX_IMAGE_SIZE,
  SUPPORTED_CONTENT_TYPES,
  isSupportedContentType,
  isValidHash,
} from "../../../src/shared/constants";

describe("SUPPORTED_CONTENT_TYPES", () => {
  test("contains exactly the four supported image types", () => {
    expect(SUPPORTED_CONTENT_TYPES).toEqual([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ]);
  });

  test("has length 4", () => {
    expect(SUPPORTED_CONTENT_TYPES).toHaveLength(4);
  });
});

describe("MAX_IMAGE_SIZE", () => {
  test("equals 25MB in bytes", () => {
    expect(MAX_IMAGE_SIZE).toBe(26214400);
  });
});

describe("HASH_LENGTH", () => {
  test("equals 43 (base64url SHA-256 without padding)", () => {
    expect(HASH_LENGTH).toBe(43);
  });
});

describe("DEFAULT_TTL", () => {
  test("equals 604800 (7 days in seconds)", () => {
    expect(DEFAULT_TTL).toBe(604800);
  });
});

describe("CDN_BASE_URL", () => {
  test("equals https://img.lekman.com", () => {
    expect(CDN_BASE_URL).toBe("https://img.lekman.com");
  });
});

describe("isSupportedContentType", () => {
  test("returns true for image/png", () => {
    expect(isSupportedContentType("image/png")).toBe(true);
  });

  test("returns true for image/jpeg", () => {
    expect(isSupportedContentType("image/jpeg")).toBe(true);
  });

  test("returns true for image/gif", () => {
    expect(isSupportedContentType("image/gif")).toBe(true);
  });

  test("returns true for image/webp", () => {
    expect(isSupportedContentType("image/webp")).toBe(true);
  });

  test("returns false for text/plain", () => {
    expect(isSupportedContentType("text/plain")).toBe(false);
  });

  test("returns false for image/svg+xml", () => {
    expect(isSupportedContentType("image/svg+xml")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isSupportedContentType("")).toBe(false);
  });

  test("returns false for image/PNG (case-sensitive)", () => {
    expect(isSupportedContentType("image/PNG")).toBe(false);
  });
});

describe("isValidHash", () => {
  test("returns true for a valid 43-char base64url string", () => {
    // A real SHA-256 base64url hash (no padding)
    expect(isValidHash("n4bQgYhMfWWaL-qgxVrQFaO_TxsrC4Is0V1sFbDwCgg")).toBe(
      true,
    );
  });

  test("returns true for hash with underscores and hyphens", () => {
    expect(isValidHash("abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNO-")).toBe(
      true,
    );
  });

  test("returns false for 42-char string (too short)", () => {
    expect(isValidHash("a".repeat(42))).toBe(false);
  });

  test("returns false for 44-char string (too long)", () => {
    expect(isValidHash("a".repeat(44))).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidHash("")).toBe(false);
  });

  test("returns false for string with + (standard base64)", () => {
    expect(isValidHash("n4bQgYhMfWWaL+qgxVrQFaO_TxsrC4Is0V1sFbDwCgg")).toBe(
      false,
    );
  });

  test("returns false for string with / (standard base64)", () => {
    expect(isValidHash("n4bQgYhMfWWaL/qgxVrQFaO_TxsrC4Is0V1sFbDwCgg")).toBe(
      false,
    );
  });

  test("returns false for string with padding =", () => {
    expect(isValidHash("n4bQgYhMfWWaLqgxVrQFaO_TxsrC4Is0V1sFbDwCg==")).toBe(
      false,
    );
  });

  test("returns false for string with spaces", () => {
    expect(isValidHash("n4bQgYhMfWWaL qgxVrQFaO TxsrC4Is0V1sFbDwCgg")).toBe(
      false,
    );
  });
});
