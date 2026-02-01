import type { IBlobClient } from "../../shared/blob-interface";
import type { ICloudflareClient } from "../../shared/cloudflare-interface";
import { CDN_BASE_URL } from "../../shared/constants";
import type { ICosmosClient } from "../../shared/cosmos-interface";
import type { DeleteResult } from "../../shared/types";

export interface DeleteDeps {
  cosmos: ICosmosClient;
  blob: IBlobClient;
  cloudflare: ICloudflareClient;
}

function isNotFoundError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.toLowerCase().includes("not found");
  }
  return false;
}

export async function handleDelete(hash: string, deps: DeleteDeps): Promise<DeleteResult> {
  // Step 1: Delete blob from storage (silently continue if not found)
  try {
    await deps.blob.delete(hash);
  } catch (err: unknown) {
    if (!isNotFoundError(err)) {
      throw err;
    }
  }

  // Step 2: Delete Cosmos document (silently continue if not found)
  try {
    await deps.cosmos.delete(hash);
  } catch (err: unknown) {
    if (!isNotFoundError(err)) {
      throw err;
    }
  }

  // Step 3: Purge Cloudflare cache (return 502 on failure)
  try {
    await deps.cloudflare.purge(`${CDN_BASE_URL}/${hash}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 502, error: message };
  }

  return { status: 204 };
}
