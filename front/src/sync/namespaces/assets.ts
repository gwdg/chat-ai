import { sha256Hex } from "../crypto/bytes";
import type { SyncAsset } from "../types";

/**
 * A single attachment or workspace-tree file larger than this is not uploaded.
 * The record keeps a placeholder so the chat or workspace still opens, and the
 * summary names it. `saia-fs` writes are whole-file MCP calls, so an unbounded
 * blob would also be held in memory twice.
 */
export const MAX_SYNC_FILE_BYTES = 8 * 1024 * 1024;

/** Per-record safety budget, so one huge workspace cannot block the sync. */
export const MAX_SYNC_FILES_PER_RECORD = 500;

/**
 * Collects the blobs one record refers to, deduplicated by plaintext hash.
 * The caller stores `{ sha256 }` in the payload and the asset bytes travel with
 * the record, so the engine can upload them before the record itself.
 */
export class AssetCollector {
  private assets = new Map<string, Uint8Array>();
  private skipped: string[] = [];

  constructor(
    private readonly maxBytes = MAX_SYNC_FILE_BYTES,
    private readonly maxFiles = MAX_SYNC_FILES_PER_RECORD,
  ) {}

  /** Returns the hash to put in the payload, or null when the file is left out. */
  add(bytes: Uint8Array, label: string): string | null {
    if (bytes.byteLength > this.maxBytes) {
      this.skipped.push(`${label} (${bytes.byteLength} bytes)`);
      return null;
    }
    const sha256 = sha256Hex(bytes);
    if (!this.assets.has(sha256)) {
      if (this.assets.size >= this.maxFiles) {
        this.skipped.push(`${label} (too many files)`);
        return null;
      }
      this.assets.set(sha256, bytes);
    }
    return sha256;
  }

  /** Record a file that is deliberately left out without reading it. */
  skip(label: string): null {
    this.skipped.push(label);
    return null;
  }

  take(): SyncAsset[] {
    return [...this.assets.entries()].map(([sha256, bytes]) => ({
      sha256,
      bytes,
    }));
  }

  takeSkipped(): string[] {
    return this.skipped;
  }
}

export const fileSizeOf = (file: File | { size?: number }) =>
  typeof (file as any)?.size === "number" ? (file as any).size : 0;
