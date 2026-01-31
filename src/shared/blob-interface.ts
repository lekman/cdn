export interface IBlobClient {
  write(hash: string, data: Buffer, contentType: string): Promise<void>;
  read(hash: string): Promise<Buffer>;
  delete(hash: string): Promise<void>;
  exists(hash: string): Promise<boolean>;
}
