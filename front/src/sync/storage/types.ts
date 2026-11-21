/**
 * The subset of a remote filesystem the sync engine needs. The SAIA filesystem
 * adapter and the in-memory test store implement it, so the engine never knows
 * which backend it writes to.
 */
export type StoredEntry = {
  name: string;
  size?: number;
  /** True when the entry is a directory (the SAIA listing reports it). */
  dir?: boolean;
};

export interface SyncStore {
  /** Direct children of `dir`; absent directories list as empty. */
  list(dir: string): Promise<StoredEntry[]>;
  read(path: string): Promise<Uint8Array>;
  /** Whole-file write. The caller uses unique names, so overwriting is safe. */
  write(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  /** Create a directory and its parents; existing directories are fine. */
  ensureDir(dir: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
