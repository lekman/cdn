/**
 * Azure Function entry point for the Delete Image function.
 * Triggered by HTTP DELETE requests routed from APIM.
 *
 * This is a *.system.ts file — excluded from coverage.
 * Contains ONLY wiring logic: request parsing, dependency instantiation, handler call.
 * Zero business logic.
 *
 * Azure Function registration (app.http) and real SDK client instantiation
 * will be wired when @azure/functions and Azure SDK packages are installed (PRD 2).
 */
import type { DeleteDeps } from "./handler";
import { handleDelete } from "./handler";

/**
 * Parses an HTTP DELETE request and invokes the delete handler.
 * Called by the Azure Functions runtime with real Cosmos, Blob, and Cloudflare clients.
 */
export async function handleDeleteRequest(
  hash: string,
  deps: DeleteDeps
): Promise<{ status: number; body?: string }> {
  const result = await handleDelete(hash, deps);

  if (result.status === 204) {
    return { status: 204 };
  }

  return {
    status: result.status,
    body: JSON.stringify({ error: result.error }),
  };
}
