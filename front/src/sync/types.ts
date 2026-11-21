/**
 * Contracts the sync engine and the namespaces share.
 *
 * A namespace is one kind of data ("conversations", "settings", ...). It turns
 * the local database into a list of self-contained records and knows how to
 * write a remote record back. The engine owns ordering, encryption, the remote
 * layout and the merge decision; it never touches Dexie or localStorage.
 */

export type SyncAsset = {
  /** SHA-256 of the plaintext, used as the remote file name. */
  sha256: string;
  bytes: Uint8Array;
};

export type LocalRecord = {
  namespace: string;
  id: string;
  /** `hashPayload(payload)`. */
  hash: string;
  payload: any;
  /** Content-addressed blobs the payload refers to. */
  assets?: SyncAsset[];
  /** Shown in the conflict list. */
  title?: string;
};

export type RemoteRecord = {
  namespace: string;
  id: string;
  rev: number;
  hash: string;
  payload: any;
  deviceId: string;
};

export type SyncConflict = {
  namespace: string;
  id: string;
  title: string;
  reason: "diverged" | "merge";
};

export type ApplyContext = {
  /** Fetch a content-addressed blob from the remote store, or null when it is absent. */
  readAsset(sha256: string): Promise<Uint8Array | null>;
  now: number;
  deviceId: string;
};

export interface SyncNamespace {
  readonly name: string;
  /** Every record this device currently holds. */
  list(): Promise<LocalRecord[]>;
  /** Write one remote record into local storage. Must be idempotent. */
  apply(record: RemoteRecord, ctx: ApplyContext): Promise<void>;
  /** Delete a local record because another device deleted it. */
  remove?(id: string): Promise<void>;
  /** Files the last `list()` could not include (too large, unreadable). */
  takeSkipped?(): string[];
  /**
   * True when `remote` contains everything `local` has (a fast-forward), so it
   * can replace the local record without a conflict copy.
   */
  extends?(local: any, remote: any): boolean;
  /**
   * Resolve a divergence without a copy. `"remote"` pulls, `"local"` pushes the
   * local record, and a record pushes that exact (merged) version.
   */
  merge?(
    local: LocalRecord,
    remote: RemoteRecord,
    base: MergeBase | undefined,
    ctx: ApplyContext,
  ): Promise<LocalRecord | "local" | "remote">;
  /** Keep a divergent remote version as a separate local record. */
  duplicate?(record: RemoteRecord, ctx: ApplyContext): Promise<void>;
  /**
   * Persist this namespace's payload alongside the sync state, so `merge` has a
   * real common ancestor. Only used by the singleton settings record.
   */
  keepsBase?: boolean;
  /** Conflicts a namespace resolved itself, appended to the summary. */
  takeConflicts?(): SyncConflict[];
  titleOf?(payload: any): string;
}

export type RecordState = {
  namespace: string;
  id: string;
  rev: number;
  hash: string;
};

/**
 * The state a merge sees: the last agreed revision plus, when the namespace set
 * `keepsBase`, the payload that revision carried. Without it a three-way merge
 * of settings would have no common ancestor.
 */
export type MergeBase = RecordState & { payload?: any };

export interface SyncStateStore {
  get(namespace: string, id: string): Promise<RecordState | undefined>;
  put(state: RecordState): Promise<void>;
  remove(namespace: string, id: string): Promise<void>;
  list(namespace: string): Promise<RecordState[]>;
  getMeta<T = any>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: any): Promise<void>;
  deleteMeta(key: string): Promise<void>;
}

export type SyncProgress = {
  phase: "prepare" | "pull" | "push" | "apply" | "done";
  namespace?: string;
  done: number;
  total: number;
};

export type SyncSummary = {
  at: number;
  pulled: number;
  pushed: number;
  deleted: number;
  skipped: string[];
  conflicts: SyncConflict[];
};
