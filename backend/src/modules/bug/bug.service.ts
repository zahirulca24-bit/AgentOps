import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../../core/errors.js';
import { redactString } from '../../infrastructure/redact/redactSensitive.js';

export interface Bug {
  id: string;
  title: string;
  description?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'fixed' | 'closed';
  evidenceId?: string;
  createdAt: string;
  updatedAt: string;
}

export class BugService {
  private rootDir: string;
  private maxSizeBytes: number;

  constructor(private storageDir: string) {
    this.rootDir = path.resolve(storageDir);
    this.maxSizeBytes = 5 * 1024 * 1024; // 5 MB per bug record
  }

  private async ensureDir() {
    await fs.mkdir(this.rootDir, { recursive: true });
  }

  private bugFilePath(id: string) {
    return path.resolve(this.rootDir, `${id}.json`);
  }

  public async createBug(data: Omit<Bug, 'id' | 'createdAt' | 'updatedAt'>): Promise<Bug> {
    await this.ensureDir();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const bug: Bug = { ...data, id, createdAt: now, updatedAt: now };
    const content = Buffer.from(JSON.stringify(bug, null, 2), 'utf-8');
    if (content.length > this.maxSizeBytes) {
      throw new AppError('PAYLOAD_TOO_LARGE', 'Bug record exceeds size limit', 413);
    }
    await fs.writeFile(this.bugFilePath(id), content);
    return bug;
  }

  public async getBug(id: string): Promise<Bug> {
    await this.ensureDir();
    const file = this.bugFilePath(id);
    try {
      const raw = await fs.readFile(file, 'utf-8');
      return JSON.parse(raw) as Bug;
    } catch {
      throw new AppError('NOT_FOUND', `Bug ${id} not found`, 404);
    }
  }

  public async listBugs(): Promise<Bug[]> {
    await this.ensureDir();
    const files = await fs.readdir(this.rootDir);
    const bugs: Bug[] = [];
    for (const f of files) {
      if (f.endsWith('.json')) {
        const raw = await fs.readFile(path.resolve(this.rootDir, f), 'utf-8');
        bugs.push(JSON.parse(raw) as Bug);
      }
    }
    return bugs;
  }

  public async updateBug(id: string, patch: Partial<Omit<Bug, 'id' | 'createdAt'>>): Promise<Bug> {
    const bug = await this.getBug(id);
    const updated = { ...bug, ...patch, updatedAt: new Date().toISOString() };
    const content = Buffer.from(JSON.stringify(updated, null, 2), 'utf-8');
    if (content.length > this.maxSizeBytes) {
      throw new AppError('PAYLOAD_TOO_LARGE', 'Bug record exceeds size limit', 413);
    }
    await fs.writeFile(this.bugFilePath(id), content);
    return updated;
  }
}
