import type { ICloudflareClient } from "../../src/shared/cloudflare-interface";
import { CloudflarePurgeError } from "../../src/shared/cloudflare-interface";

export class CloudflareClientMock implements ICloudflareClient {
  private purgeCalls: string[] = [];
  private shouldFail = false;
  private failStatusCode = 500;

  setPurgeShouldFail(fail: boolean, statusCode = 500): void {
    this.shouldFail = fail;
    this.failStatusCode = statusCode;
  }

  getPurgeCalls(): string[] {
    return [...this.purgeCalls];
  }

  clear(): void {
    this.purgeCalls = [];
    this.shouldFail = false;
    this.failStatusCode = 500;
  }

  async purge(url: string): Promise<void> {
    if (this.shouldFail) {
      throw new CloudflarePurgeError(
        "CloudflareClientMock: simulated purge failure",
        this.failStatusCode,
      );
    }
    this.purgeCalls.push(url);
  }
}
