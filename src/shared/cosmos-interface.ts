import type { ImageDocument } from "./types";

export interface ICosmosClient {
  read(id: string): Promise<ImageDocument | null>;
  create(doc: ImageDocument): Promise<ImageDocument>;
  update(id: string, updates: Partial<ImageDocument>): Promise<ImageDocument>;
  delete(id: string): Promise<void>;
}
