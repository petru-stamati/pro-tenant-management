import { Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

/**
 * Cloudflare R2 (S3-compatible) storage — the real, persistent backend for
 * production. R2 has no egress fees, unlike S3, which matters here since
 * every document view goes through DocumentsService.downloadBuffer rather
 * than a public URL (documents are private, permission-gated).
 */
@Injectable()
export class R2StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET_NAME ?? '';
    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new Error(
        'R2 storage is selected but R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME are not all set',
      );
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async writeFile(s3Key: string, buffer: Buffer): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: s3Key, Body: buffer }));
  }

  async readFile(s3Key: string): Promise<Buffer> {
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }));
      const bytes = await response.Body!.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      throw new NotFoundException('File not found in storage');
    }
  }

  async fileExists(s3Key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: s3Key }));
      return true;
    } catch {
      return false;
    }
  }
}
