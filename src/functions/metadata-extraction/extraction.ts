import exifReader from "exif-reader";
import { imageSize } from "image-size";
import type { ExifData } from "../../shared/types";

/**
 * Converts EXIF GPS DMS (degrees, minutes, seconds) to decimal degrees.
 * Negates the result for "S" (south) or "W" (west) references.
 */
export function convertGpsToDecimal(dms: number[], ref: string): number {
  const [degrees = 0, minutes = 0, seconds = 0] = dms;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}

/**
 * Extracts image dimensions from a buffer using the image-size library.
 * Throws if the buffer is empty or contains invalid image data.
 */
export function extractDimensions(buffer: Uint8Array): { width: number; height: number } {
  if (buffer.length === 0) {
    throw new Error("Empty buffer");
  }
  const result = imageSize(buffer);
  return { width: result.width, height: result.height };
}

/**
 * Finds the EXIF APP1 segment in a JPEG buffer and returns the TIFF data slice.
 * Returns null if no valid EXIF APP1 segment is found.
 */
function findExifTiffData(buffer: Buffer): Buffer | null {
  // JPEG must start with SOI marker 0xFF 0xD8
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    // Each marker starts with 0xFF
    if (buffer[offset] !== 0xff) {
      return null;
    }

    const marker = buffer[offset + 1];
    if (marker === undefined) {
      return null;
    }

    // Skip padding bytes (0xFF followed by another 0xFF)
    if (marker === 0xff) {
      offset++;
      continue;
    }

    // SOS marker means we've hit image data — stop scanning
    if (marker === 0xda) {
      return null;
    }

    // Standalone markers without length (SOI, EOI, RST0-RST7)
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // Read segment length
    if (offset + 4 > buffer.length) {
      return null;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const segmentDataStart = offset + 4;
    const segmentEnd = offset + 2 + segmentLength;

    // APP1 marker (0xE1)
    if (marker === 0xe1) {
      // Check for "Exif\0\0" header (6 bytes)
      if (
        segmentDataStart + 6 <= buffer.length &&
        buffer[segmentDataStart] === 0x45 &&
        buffer[segmentDataStart + 1] === 0x78 &&
        buffer[segmentDataStart + 2] === 0x69 &&
        buffer[segmentDataStart + 3] === 0x66 &&
        buffer[segmentDataStart + 4] === 0x00 &&
        buffer[segmentDataStart + 5] === 0x00
      ) {
        const tiffStart = segmentDataStart + 6;
        if (tiffStart < segmentEnd && segmentEnd <= buffer.length) {
          return buffer.subarray(tiffStart, segmentEnd);
        }
      }
    }

    // Advance past this segment
    offset = segmentEnd;
  }

  return null;
}

/**
 * Formats a camera string from Make and Model EXIF fields.
 * If Model already starts with Make, returns just Model. Otherwise "Make Model".
 */
function formatCamera(make: string | undefined, model: string | undefined): string | null {
  const trimmedMake = (make ?? "").trim();
  const trimmedModel = (model ?? "").trim();

  if (!trimmedMake && !trimmedModel) {
    return null;
  }
  if (!trimmedMake) {
    return trimmedModel;
  }
  if (!trimmedModel) {
    return trimmedMake;
  }
  if (trimmedModel.startsWith(trimmedMake)) {
    return trimmedModel;
  }
  return `${trimmedMake} ${trimmedModel}`;
}

/**
 * Extracts EXIF metadata from a JPEG buffer.
 * Returns null for non-JPEG buffers, buffers without EXIF, or if parsing fails.
 * Never throws.
 */
export function extractExif(buffer: Buffer): ExifData | null {
  try {
    const tiffData = findExifTiffData(buffer);
    if (!tiffData) {
      return null;
    }

    const exif = exifReader(tiffData);

    const dateTimeOriginal = exif.Photo?.DateTimeOriginal;
    const created = dateTimeOriginal instanceof Date ? dateTimeOriginal.toISOString() : null;

    const gpsLat = exif.GPSInfo?.GPSLatitude;
    const gpsLatRef = exif.GPSInfo?.GPSLatitudeRef;
    const gpsLon = exif.GPSInfo?.GPSLongitude;
    const gpsLonRef = exif.GPSInfo?.GPSLongitudeRef;

    let location: { lat: number; lon: number } | null = null;
    if (
      Array.isArray(gpsLat) &&
      typeof gpsLatRef === "string" &&
      Array.isArray(gpsLon) &&
      typeof gpsLonRef === "string"
    ) {
      location = {
        lat: convertGpsToDecimal(gpsLat, gpsLatRef),
        lon: convertGpsToDecimal(gpsLon, gpsLonRef),
      };
    }

    const camera = formatCamera(exif.Image?.Make, exif.Image?.Model);

    if (!created && !location && !camera) {
      return null;
    }

    return { created, location, camera };
  } catch {
    return null;
  }
}
