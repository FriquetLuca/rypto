import type { OpenMode } from 'node:fs';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

interface CacheEntry {
  value: string | Buffer;
  size: number;
}

export interface ReadOptions {
  signal?: AbortSignal;
  flag?: OpenMode;
}

export interface ReadTextOptions extends ReadOptions {
  encoding: BufferEncoding;
}

export interface CacheStats {
  entries: number;
  bytes: number;
  maxBytes: number;
}

export class FileCache {
  private readonly entries = new Map<string, CacheEntry>();
  private totalSize = 0;
  private readonly maxBytes;
  private readonly maxEntryBytes;
  constructor(
    maxBytes = 67108864, // 64 * 1024 * 1024 MiB
    maxEntryBytes = 2097152 // 2 * 1024 * 1024 MiB
  ) {
    this.maxBytes = maxBytes;
    this.maxEntryBytes = maxEntryBytes;
  }
  #getCached(filePath: string) {
    const cached = this.entries.get(filePath);
    if (cached) {
      this.entries.delete(filePath);
      this.entries.set(filePath, cached);
      return cached.value;
    }
  }
  #evictOldEntries(
    filePath: string,
    value: string | Buffer<ArrayBufferLike>,
    options: Partial<ReadTextOptions>
  ) {
    const size = Buffer.byteLength(value, options?.encoding);
    // Don't cache oversized pages, but still serve them.
    if (size > this.maxEntryBytes || size > this.maxBytes) {
      return value;
    }
    while (this.totalSize + size > this.maxBytes && this.entries.size > 0) {
      const oldestKey = this.entries.keys().next().value!;
      const oldest = this.entries.get(oldestKey)!;
      this.entries.delete(oldestKey);
      this.totalSize -= oldest.size;
    }
    this.entries.set(filePath, { value: value, size });
    this.totalSize += size;
    return value;
  }
  get(filePath: string, options: ReadOptions): Buffer | undefined;
  get(filePath: string, options: ReadTextOptions): string | undefined;
  get(
    filePath: string,
    options: Partial<ReadTextOptions>
  ): string | Buffer | undefined {
    const cached = this.#getCached(filePath);
    if (cached !== undefined) return cached;
    let value: string | Buffer;
    try {
      value = fs.readFileSync(filePath, options);
    } catch {
      return undefined;
    }
    return this.#evictOldEntries(filePath, value, options);
  }
  async getAsync(
    filePath: string,
    options: ReadOptions
  ): Promise<Buffer | undefined>;
  async getAsync(
    filePath: string,
    options: ReadTextOptions
  ): Promise<string | undefined>;
  async getAsync(
    filePath: string,
    options: Partial<ReadTextOptions>
  ): Promise<string | Buffer | undefined> {
    const cached = this.#getCached(filePath);
    if (cached !== undefined) return cached;
    let value: string | Buffer;
    try {
      value = await fsp.readFile(filePath, options);
    } catch {
      return undefined;
    }
    return this.#evictOldEntries(filePath, value, options);
  }
  clear(): void {
    this.entries.clear();
    this.totalSize = 0;
  }
  get stats(): CacheStats {
    return {
      entries: this.entries.size,
      bytes: this.totalSize,
      maxBytes: this.maxBytes,
    };
  }
}
