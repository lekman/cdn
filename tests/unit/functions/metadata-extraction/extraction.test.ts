import { describe, expect, test } from "bun:test";
import {
  convertGpsToDecimal,
  extractDimensions,
  extractExif,
} from "../../../../src/functions/metadata-extraction/extraction";

// Minimal 1x1 image buffers for dimension tests
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEFTkSuQmCC",
  "base64"
);

const GIF_1X1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// SOI + APP0 (JFIF) + DQT + SOF0 (1x1) + DHT + SOS + EOI
const JPEG_1X1 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
  0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
  0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
  0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
  0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
  0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2,
  0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6,
  0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda,
  0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7b, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0xff,
  0xd9,
]);

// RIFF header + WEBP + VP8 chunk (1x1)
const WEBP_1X1 = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAQAcJYgCdAEO/hepAA==",
  "base64"
);

/**
 * Builds a minimal valid TIFF structure containing EXIF metadata.
 * Includes Make, Model, DateTimeOriginal, and GPS coordinates for London.
 */
function buildExifTiffData(): Buffer {
  const buf = Buffer.alloc(221);

  // TIFF Header (little-endian)
  buf.write("II", 0, "ascii");
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(8, 4);

  // IFD0 at offset 8: 4 entries
  buf.writeUInt16LE(4, 8);

  // Entry 1: Make (0x010F) — ASCII, 6 chars, offset 62
  let off = 10;
  buf.writeUInt16LE(0x010f, off);
  buf.writeUInt16LE(2, off + 2);
  buf.writeUInt32LE(6, off + 4);
  buf.writeUInt32LE(62, off + 8);

  // Entry 2: Model (0x0110) — ASCII, 13 chars, offset 68
  off = 22;
  buf.writeUInt16LE(0x0110, off);
  buf.writeUInt16LE(2, off + 2);
  buf.writeUInt32LE(13, off + 4);
  buf.writeUInt32LE(68, off + 8);

  // Entry 3: ExifIFD pointer (0x8769) — LONG, offset 81
  off = 34;
  buf.writeUInt16LE(0x8769, off);
  buf.writeUInt16LE(4, off + 2);
  buf.writeUInt32LE(1, off + 4);
  buf.writeUInt32LE(81, off + 8);

  // Entry 4: GPSInfo pointer (0x8825) — LONG, offset 119
  off = 46;
  buf.writeUInt16LE(0x8825, off);
  buf.writeUInt16LE(4, off + 2);
  buf.writeUInt32LE(1, off + 4);
  buf.writeUInt32LE(119, off + 8);

  // Next IFD offset: none
  buf.writeUInt32LE(0, 58);

  // Data: Make at 62
  buf.write("Canon\0", 62, "ascii");

  // Data: Model at 68
  buf.write("Canon EOS R5\0", 68, "ascii");

  // Exif Sub-IFD at offset 81: 1 entry
  buf.writeUInt16LE(1, 81);

  // DateTimeOriginal (0x9003) — ASCII, 20 chars, offset 99
  off = 83;
  buf.writeUInt16LE(0x9003, off);
  buf.writeUInt16LE(2, off + 2);
  buf.writeUInt32LE(20, off + 4);
  buf.writeUInt32LE(99, off + 8);

  // Next IFD offset: none
  buf.writeUInt32LE(0, 95);

  // Data: DateTimeOriginal at 99
  buf.write("2025:06:15 10:30:00\0", 99, "ascii");

  // GPS IFD at offset 119: 4 entries
  buf.writeUInt16LE(4, 119);

  // GPSLatitudeRef (0x0001) — ASCII, 2 chars, inline "N\0"
  off = 121;
  buf.writeUInt16LE(0x0001, off);
  buf.writeUInt16LE(2, off + 2);
  buf.writeUInt32LE(2, off + 4);
  buf[off + 8] = 0x4e; // "N"
  buf[off + 9] = 0x00;
  buf[off + 10] = 0x00;
  buf[off + 11] = 0x00;

  // GPSLatitude (0x0002) — RATIONAL x3, offset 173
  off = 133;
  buf.writeUInt16LE(0x0002, off);
  buf.writeUInt16LE(5, off + 2);
  buf.writeUInt32LE(3, off + 4);
  buf.writeUInt32LE(173, off + 8);

  // GPSLongitudeRef (0x0003) — ASCII, 2 chars, inline "W\0"
  off = 145;
  buf.writeUInt16LE(0x0003, off);
  buf.writeUInt16LE(2, off + 2);
  buf.writeUInt32LE(2, off + 4);
  buf[off + 8] = 0x57; // "W"
  buf[off + 9] = 0x00;
  buf[off + 10] = 0x00;
  buf[off + 11] = 0x00;

  // GPSLongitude (0x0004) — RATIONAL x3, offset 197
  off = 157;
  buf.writeUInt16LE(0x0004, off);
  buf.writeUInt16LE(5, off + 2);
  buf.writeUInt32LE(3, off + 4);
  buf.writeUInt32LE(197, off + 8);

  // Next IFD offset: none
  buf.writeUInt32LE(0, 169);

  // GPS Latitude data at 173: 51deg 30' 26.46" N (London)
  off = 173;
  buf.writeUInt32LE(51, off);
  buf.writeUInt32LE(1, off + 4);
  buf.writeUInt32LE(30, off + 8);
  buf.writeUInt32LE(1, off + 12);
  buf.writeUInt32LE(2646, off + 16);
  buf.writeUInt32LE(100, off + 20);

  // GPS Longitude data at 197: 0deg 7' 40.08" W (London)
  off = 197;
  buf.writeUInt32LE(0, off);
  buf.writeUInt32LE(1, off + 4);
  buf.writeUInt32LE(7, off + 8);
  buf.writeUInt32LE(1, off + 12);
  buf.writeUInt32LE(4008, off + 16);
  buf.writeUInt32LE(100, off + 20);

  return buf;
}

/**
 * Builds a minimal TIFF with only an Orientation tag (no relevant EXIF fields).
 */
function buildMinimalTiffData(): Buffer {
  // Header (8) + IFD0 count (2) + 1 entry (12) + next IFD (4) = 26 bytes
  const buf = Buffer.alloc(26);

  buf.write("II", 0, "ascii");
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(8, 4);

  // IFD0: 1 entry
  buf.writeUInt16LE(1, 8);

  // Orientation (0x0112) — SHORT, count 1, value 1 (normal)
  const off = 10;
  buf.writeUInt16LE(0x0112, off);
  buf.writeUInt16LE(3, off + 2); // SHORT type
  buf.writeUInt32LE(1, off + 4);
  buf.writeUInt16LE(1, off + 8); // value = 1
  buf.writeUInt16LE(0, off + 10);

  // Next IFD offset: none
  buf.writeUInt32LE(0, 22);

  return buf;
}

/**
 * Wraps raw TIFF data into a valid JPEG with an EXIF APP1 segment.
 */
function createJpegWithExif(tiffData: Buffer): Buffer {
  const exifHeader = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  const segmentLength = 2 + exifHeader.length + tiffData.length;

  const segment = Buffer.alloc(2 + 2 + exifHeader.length + tiffData.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(segmentLength, 2);
  exifHeader.copy(segment, 4);
  tiffData.copy(segment, 10);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    segment,
    Buffer.from([0xff, 0xd9]), // EOI
  ]);
}

describe("convertGpsToDecimal", () => {
  test("converts north latitude DMS to positive decimal", () => {
    const result = convertGpsToDecimal([51, 30, 26.46], "N");
    expect(Math.abs(result - 51.5074)).toBeLessThan(0.001);
  });

  test("converts west longitude DMS to negative decimal", () => {
    const result = convertGpsToDecimal([0, 7, 40.08], "W");
    expect(Math.abs(result - -0.1278)).toBeLessThan(0.001);
  });

  test("returns zero for all-zero DMS with north reference", () => {
    const result = convertGpsToDecimal([0, 0, 0], "N");
    expect(result).toBe(0);
  });

  test("converts south latitude DMS to negative decimal", () => {
    const result = convertGpsToDecimal([33, 51, 54.0], "S");
    expect(Math.abs(result - -33.865)).toBeLessThan(0.001);
  });
});

describe("extractDimensions", () => {
  test("returns 1x1 for a minimal PNG", () => {
    const result = extractDimensions(PNG_1X1);
    expect(result).toEqual({ width: 1, height: 1 });
  });

  test("returns 1x1 for a minimal GIF", () => {
    const result = extractDimensions(GIF_1X1);
    expect(result).toEqual({ width: 1, height: 1 });
  });

  test("returns 1x1 for a minimal JPEG", () => {
    const result = extractDimensions(JPEG_1X1);
    expect(result).toEqual({ width: 1, height: 1 });
  });

  test("returns 1x1 for a minimal WebP", () => {
    const result = extractDimensions(WEBP_1X1);
    expect(result).toEqual({ width: 1, height: 1 });
  });

  test("throws for an empty buffer", () => {
    expect(() => extractDimensions(Buffer.alloc(0))).toThrow();
  });

  test("throws for random bytes that are not a valid image", () => {
    expect(() => extractDimensions(Buffer.from([0xde, 0xad, 0xbe, 0xef]))).toThrow();
  });
});

describe("extractExif", () => {
  test("returns null for a PNG buffer (no EXIF in PNG)", () => {
    const result = extractExif(PNG_1X1);
    expect(result).toBeNull();
  });

  test("returns null for random bytes", () => {
    const result = extractExif(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    expect(result).toBeNull();
  });

  test("returns null for an empty buffer", () => {
    const result = extractExif(Buffer.alloc(0));
    expect(result).toBeNull();
  });

  test("returns null for a JPEG without EXIF APP1 segment", () => {
    const result = extractExif(JPEG_1X1);
    expect(result).toBeNull();
  });

  test("returns null for a JPEG with EXIF but no relevant fields", () => {
    const tiff = buildMinimalTiffData();
    const jpeg = createJpegWithExif(tiff);
    const result = extractExif(jpeg);
    expect(result).toBeNull();
  });

  test("returns null for corrupted EXIF data inside APP1", () => {
    const corruptTiff = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const jpeg = createJpegWithExif(corruptTiff);
    const result = extractExif(jpeg);
    expect(result).toBeNull();
  });

  test("extracts full EXIF metadata from a JPEG with valid EXIF data", () => {
    const tiff = buildExifTiffData();
    const jpeg = createJpegWithExif(tiff);
    const result = extractExif(jpeg);

    expect(result).not.toBeNull();
    expect(result!.created).toBe("2025-06-15T10:30:00.000Z");
    expect(result!.camera).toBe("Canon EOS R5");
    expect(result!.location).not.toBeNull();
    expect(Math.abs(result!.location!.lat - 51.5074)).toBeLessThan(0.001);
    expect(Math.abs(result!.location!.lon - -0.1278)).toBeLessThan(0.001);
  });
});
