export interface ICloudflareClient {
  purge(url: string): Promise<void>;
}

export class CloudflarePurgeError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "CloudflarePurgeError";
    this.statusCode = statusCode;
  }
}
