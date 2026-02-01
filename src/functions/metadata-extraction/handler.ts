import type { IBlobClient } from "../../shared/blob-interface";
import type { ICosmosClient } from "../../shared/cosmos-interface";
import { extractDimensions, extractExif } from "./extraction";

export interface ExtractionMessage {
  hash: string;
}

export interface ExtractionDeps {
  cosmos: ICosmosClient;
  blob: IBlobClient;
}

export async function extractMetadata(
  message: ExtractionMessage,
  deps: ExtractionDeps
): Promise<void> {
  if (!message.hash || typeof message.hash !== "string") {
    return;
  }

  try {
    const buffer = await deps.blob.read(message.hash);
    const dimensions = extractDimensions(buffer);
    const exif = extractExif(buffer);

    await deps.cosmos.update(message.hash, {
      status: "ready",
      width: dimensions.width,
      height: dimensions.height,
      exif: exif,
    });
  } catch {
    try {
      await deps.cosmos.update(message.hash, { status: "failed" });
    } catch {
      // Cosmos update itself failed — nothing more we can do, swallow
    }
  }
}
