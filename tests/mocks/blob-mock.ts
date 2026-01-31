import type { IBlobClient } from "../../src/shared/blob-interface";

export class BlobClientMock implements IBlobClient {
  private store = new Map<string, { data: Buffer; contentType: string }>();
  private shouldFail = false;

  setBlob(hash: string, data: Buffer, contentType: string): void {
    this.store.set(hash, { data, contentType });
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  clear(): void {
    this.store.clear();
    this.shouldFail = false;
  }

  async write(hash: string, data: Buffer, contentType: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error("BlobClientMock: simulated failure");
    }
    this.store.set(hash, { data, contentType });
  }

  async read(hash: string): Promise<Buffer> {
    if (this.shouldFail) {
      throw new Error("BlobClientMock: simulated failure");
    }
    const entry = this.store.get(hash);
    if (!entry) {
      throw new Error(`BlobClientMock: blob '${hash}' not found`);
    }
    return entry.data;
  }

  async delete(hash: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error("BlobClientMock: simulated failure");
    }
    this.store.delete(hash);
  }

  async exists(hash: string): Promise<boolean> {
    if (this.shouldFail) {
      throw new Error("BlobClientMock: simulated failure");
    }
    return this.store.has(hash);
  }
}
