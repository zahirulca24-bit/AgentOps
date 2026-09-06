import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { EnvConfig } from '../../config/env.js';
import { AppError } from '../../core/errors.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';

export interface StoreEvidenceOptions {
  filename?: string;
  contentType?: string;
  content: Buffer | string;
  runId?: string;
  testCaseId?: string;
}

export interface EvidenceMetadata {
  id: string;
  filePath: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export class EvidenceService {
  private rootDir: string;
  private maxSizeBytes: number;

  constructor(private config: EnvConfig) {
    this.rootDir = path.resolve(config.EVIDENCE_STORAGE_DIR || './evidence');
    this.maxSizeBytes = (config.MAX_EVIDENCE_SIZE_MB || 10) * 1024 * 1024;
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.rootDir, { recursive: true });
    } catch (err) {
      throw new AppError('INTERNAL_ERROR', `Failed to initialize evidence storage directory: ${(err as Error).message}`, 500);
    }
  }

  public async storeEvidence(options: StoreEvidenceOptions): Promise<EvidenceMetadata> {
    await this.initialize();

    const evidenceId = crypto.randomUUID();
    const ext = options.filename ? path.extname(options.filename) : '.dat';
    // Sanitize extension to prevent dangerous files
    const safeExt = /^[a-zA-Z0-9.]+$/.test(ext) ? ext : '.dat';
    const safeFilename = `${evidenceId}${safeExt}`;
    const targetPath = path.resolve(this.rootDir, safeFilename);

    // Path Traversal Security Check
    if (!targetPath.startsWith(this.rootDir)) {
      throw new AppError('SECURITY_ERROR', 'Invalid evidence filename or path traversal attempt', 400);
    }

    let bufferContent: Buffer;
    if (typeof options.content === 'string') {
      const redactedText = redactString(options.content);
      bufferContent = Buffer.from(redactedText, 'utf-8');
    } else {
      bufferContent = options.content;
    }

    if (bufferContent.length > this.maxSizeBytes) {
      throw new AppError('PAYLOAD_TOO_LARGE', `Evidence size exceeds maximum allowed limit of ${this.config.MAX_EVIDENCE_SIZE_MB}MB`, 413);
    }

    await fs.writeFile(targetPath, bufferContent);

    return {
      id: evidenceId,
      filePath: targetPath,
      contentType: options.contentType || 'application/octet-stream',
      sizeBytes: bufferContent.length,
      createdAt: new Date().toISOString(),
    };
  }

  public async getEvidence(evidenceId: string): Promise<{ content: Buffer; filePath: string }> {
    await this.initialize();

    // Validate ID format (must be alphanumeric or UUID format)
    if (!/^[a-zA-Z0-9-]+$/.test(evidenceId)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid evidence ID format', 400);
    }

    // Find file matching evidence ID prefix in rootDir
    const files = await fs.readdir(this.rootDir);
    const targetFile = files.find(f => f.startsWith(evidenceId));

    if (!targetFile) {
      throw new AppError('NOT_FOUND', `Evidence ${evidenceId} not found`, 404);
    }

    const fullPath = path.resolve(this.rootDir, targetFile);

    // Path Traversal Security Check
    if (!fullPath.startsWith(this.rootDir)) {
      throw new AppError('SECURITY_ERROR', 'Access denied: Path traversal detected', 403);
    }

    try {
      const content = await fs.readFile(fullPath);
      return { content, filePath: fullPath };
    } catch (err) {
      throw new AppError('NOT_FOUND', `Failed to read evidence file ${evidenceId}`, 404);
    }
  }
}
