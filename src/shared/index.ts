export type {
  ImageStatus,
  ExifData,
  ImageDocument,
  DeleteResult,
  MetadataResult,
  CreateImageInput,
} from "./types";
export { isValidStatus, isExifData, isImageDocument } from "./types";

export {
  SUPPORTED_CONTENT_TYPES,
  MAX_IMAGE_SIZE,
  HASH_LENGTH,
  DEFAULT_TTL,
  CDN_BASE_URL,
  isSupportedContentType,
  isValidHash,
} from "./constants";
export type { SupportedContentType } from "./constants";

export type { ICosmosClient } from "./cosmos-interface";
export type { IBlobClient } from "./blob-interface";
export type { ICloudflareClient } from "./cloudflare-interface";
export { CloudflarePurgeError } from "./cloudflare-interface";
