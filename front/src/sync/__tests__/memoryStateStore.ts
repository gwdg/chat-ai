import type { RecordState, SyncStateStore } from "../types";

/**
 * `SyncStateStore` on plain maps: the engine tests never need Dexie, and a
 * second "device" is simply a second instance.
 */
export class MemoryStateStore implements SyncStateStore {
  private records = new Map<string, RecordState>();
  private meta = new Map<string, any>();

  private keyOf(namespace: string, id: string) {
    return `${namespace}:${id}`;
  }

  async get(namespace: string, id: string): Promise<RecordState | undefined> {
    return this.records.get(this.keyOf(namespace, id));
  }

  async put(state: RecordState): Promise<void> {
    this.records.set(this.keyOf(state.namespace, state.id), { ...state });
  }

  async remove(namespace: string, id: string): Promise<void> {
    this.records.delete(this.keyOf(namespace, id));
  }

  async list(namespace: string): Promise<RecordState[]> {
    return [...this.records.values()]
      .filter((state) => state.namespace === namespace)
      .map((state) => ({ ...state }));
  }

  async getMeta<T = any>(key: string): Promise<T | undefined> {
    return this.meta.get(key);
  }

  async setMeta(key: string, value: any): Promise<void> {
    this.meta.set(key, value);
  }

  async deleteMeta(key: string): Promise<void> {
    this.meta.delete(key);
  }
}
