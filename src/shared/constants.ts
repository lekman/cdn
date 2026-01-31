export const SUPPORTED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type SupportedContentType = (typeof SUPPORTED_CONTENT_TYPES)[number];

export const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

export const HASH_LENGTH = 43;

export const DEFAULT_TTL = 604800;

export const CDN_BASE_URL = "https://img.lekman.com";

const SUPPORTED_SET: ReadonlySet<string> = new Set(SUPPORTED_CONTENT_TYPES);

export function isSupportedContentType(value: string): value is SupportedContentType {
  return SUPPORTED_SET.has(value);
}

const HASH_REGEX = /^[A-Za-z0-9_-]{43}$/;

export function isValidHash(value: string): boolean {
  return HASH_REGEX.test(value);
}
