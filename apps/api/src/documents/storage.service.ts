/**
 * Storage backend contract — anything documents get written to and read
 * from (Phase 1 §3). Two implementations: LocalStorageService (dev-only,
 * disk under the repo) and R2StorageService (Cloudflare R2, production).
 * DocumentsService depends on this token, never a concrete class, so the
 * backend swap in documents.module.ts is the only place that changes.
 */
export abstract class StorageService {
  abstract writeFile(s3Key: string, buffer: Buffer): Promise<void>;
  abstract readFile(s3Key: string): Promise<Buffer>;
  abstract fileExists(s3Key: string): Promise<boolean>;
}
