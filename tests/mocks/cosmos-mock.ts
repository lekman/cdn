import type { ICosmosClient } from "../../src/shared/cosmos-interface";
import type { ImageDocument } from "../../src/shared/types";

export class CosmosClientMock implements ICosmosClient {
  private store = new Map<string, ImageDocument>();
  private shouldFail = false;

  setDocument(doc: ImageDocument): void {
    this.store.set(doc.id, doc);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  clear(): void {
    this.store.clear();
    this.shouldFail = false;
  }

  async read(id: string): Promise<ImageDocument | null> {
    if (this.shouldFail) {
      throw new Error("CosmosClientMock: simulated failure");
    }
    return this.store.get(id) ?? null;
  }

  async create(doc: ImageDocument): Promise<ImageDocument> {
    if (this.shouldFail) {
      throw new Error("CosmosClientMock: simulated failure");
    }
    this.store.set(doc.id, doc);
    return doc;
  }

  async update(id: string, updates: Partial<ImageDocument>): Promise<ImageDocument> {
    if (this.shouldFail) {
      throw new Error("CosmosClientMock: simulated failure");
    }
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`CosmosClientMock: document '${id}' not found`);
    }
    const updated = { ...existing, ...updates, id };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error("CosmosClientMock: simulated failure");
    }
    this.store.delete(id);
  }
}
