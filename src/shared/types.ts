/**
 * Valid states for an image document in Cosmos DB.
 * Lifecycle: processing → ready | failed
 */
export type ImageStatus = "processing" | "ready" | "failed";

const VALID_STATUSES: ReadonlySet<string> = new Set<string>([
  "processing",
  "ready",
  "failed",
]);

/**
 * Runtime type guard for ImageStatus.
 */
export function isValidStatus(value: unknown): value is ImageStatus {
  return typeof value === "string" && VALID_STATUSES.has(value);
}

/**
 * EXIF metadata extracted from an image.
 */
export interface ExifData {
  created: string | null;
  location: { lat: number; lon: number } | null;
  camera: string | null;
}

/**
 * Runtime type guard for ExifData.
 */
export function isExifData(value: unknown): value is ExifData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (!("created" in obj) || !("location" in obj) || !("camera" in obj)) {
    return false;
  }

  if (obj.created !== null && typeof obj.created !== "string") {
    return false;
  }

  if (obj.camera !== null && typeof obj.camera !== "string") {
    return false;
  }

  if (obj.location !== null) {
    if (typeof obj.location !== "object") {
      return false;
    }
    const loc = obj.location as Record<string, unknown>;
    if (typeof loc.lat !== "number" || typeof loc.lon !== "number") {
      return false;
    }
  }

  return true;
}

/**
 * Cosmos DB document representing a stored image.
 * Matches EPIC §4.1 schema.
 */
export interface ImageDocument {
  id: string;
  url: string;
  status: ImageStatus;
  size: number;
  contentType: string;
  width: number | null;
  height: number | null;
  exif: ExifData | null;
  createdAt: string;
  ttl: number;
}

/**
 * Runtime type guard for ImageDocument.
 */
export function isImageDocument(value: unknown): value is ImageDocument {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.id !== "string" || typeof obj.url !== "string") {
    return false;
  }

  if (!isValidStatus(obj.status)) {
    return false;
  }

  if (typeof obj.size !== "number" || typeof obj.contentType !== "string") {
    return false;
  }

  if (obj.width !== null && typeof obj.width !== "number") {
    return false;
  }

  if (obj.height !== null && typeof obj.height !== "number") {
    return false;
  }

  if (obj.exif !== null && !isExifData(obj.exif)) {
    return false;
  }

  if (typeof obj.createdAt !== "string" || typeof obj.ttl !== "number") {
    return false;
  }

  return true;
}

/**
 * Result of a delete operation.
 */
export interface DeleteResult {
  status: number;
  error?: string;
}

/**
 * Result of metadata extraction from an image.
 */
export interface MetadataResult {
  width: number;
  height: number;
  exif: ExifData | null;
}

/**
 * Input for creating a new image document in Cosmos DB.
 */
export interface CreateImageInput {
  hash: string;
  size: number;
  contentType: string;
}
