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
 * Returns true if the value is a valid ImageStatus string.
 */
export function isValidStatus(value: unknown): value is ImageStatus {
  return typeof value === "string" && VALID_STATUSES.has(value);
}
