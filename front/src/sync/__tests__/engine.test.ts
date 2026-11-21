import { describe, expect, it } from "vitest";

import { hashPayload } from "../canonical";
import { equalBytes, random, sha256Hex } from "../crypto/bytes";
import {
  collectGarbage,
  readIndex,
  recordFileName,
  runSync,
  SYNC_ASSETS_DIR,
  SYNC_INDEX_DIR,
  SYNC_RECORDS_DIR,
} from "../engine";
import { MemorySyncStore } from "../storage/memoryStore";
import type { SyncStore } from "../storage/types";
import { MemoryStateStore } from "./memoryStateStore";

/**
 * Two devices are two `MemorySyncStore`s plus two `MemoryStateStore`s. The
 * same vault keys and the same namespace storage (a `Map`) stand in for Dexie.
 */
const makeKeys = () => ({
  vaultKey: random(32),
  blobKey: random(32),
  assetKey: random(32),
});

type Fake = { data: Map<string, any>; duplicates: any[]; removed: string[] };

const makeNamespace = (fake: Fake, extra: Record<string, any> = {}) => ({
  name: "chats",
  async list() {
    return [...fake.data.entries()].map(([id, payload]) => ({
      namespace: "chats",
      id,
      hash: hashPayload(payload),
      payload,
      title: String(payload?.title ?? id),
    }));
  },
  async apply(record: any) {
    fake.data.set(record.id, record.payload);
  },
  async remove(id: string) {
    fake.removed.push(id);
    fake.data.delete(id);
  },
  async duplicate(record: any) {
    fake.duplicates.push(record.payload);
  },
  titleOf(payload: any) {
    return String(payload?.title ?? "Chat");
  },
  ...extra,
});

const fakeOf = (entries: [string, any][] = []): Fake => ({
  data: new Map(entries),
  duplicates: [],
  removed: [],
});

const sync = (
  store: MemorySyncStore,
  keys: any,
  state: MemoryStateStore,
  deviceId: string,
  fake: Fake,
  now: number,
  extra: Record<string, any> = {},
) =>
  runSync({
    store,
    keys,
    namespaces: [makeNamespace(fake, extra) as any],
    state,
    deviceId,
    now,
  });

/**
 * The same store, except that publishing the device fragment fails: the case of
 * a browser closed — or a connection lost — after the record files were uploaded
 * but before the index fragment that references them was written.
 */
const withFailingPublish = (store: MemorySyncStore): SyncStore => {
  let remaining = 1;
  return {
    list: (dir) => store.list(dir),
    read: (path) => store.read(path),
    write: async (path, bytes) => {
      if (path.startsWith(SYNC_INDEX_DIR) && remaining > 0) {
        remaining -= 1;
        throw new Error("The network went away.");
      }
      return store.write(path, bytes);
    },
    remove: (path) => store.remove(path),
    ensureDir: (dir) => store.ensureDir(dir),
    exists: (path) => store.exists(path),
  };
};

describe("sync engine", () => {
  it("pushes a record and pulls it on another device", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "One" }]]);
    const b = fakeOf();

    await sync(store, keys, new MemoryStateStore(), "dev-a", a, 1000);
    expect(store.paths()).toContain(
      `${SYNC_RECORDS_DIR}/chats/${recordFileName("c1", 1000, "dev-a")}`,
    );

    const stateB = new MemoryStateStore();
    const summary = await sync(store, keys, stateB, "dev-b", b, 2000);
    expect(summary.pulled).toBe(1);
    expect(b.data.get("c1")).toEqual({ title: "One" });
    expect(await stateB.get("chats", "c1")).toMatchObject({ rev: 1000 });
  });

  it("keeps both versions when two independent devices hold the same id", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "Mine" }]]);
    const b = fakeOf([["c1", { title: "Theirs" }]]);

    await sync(store, keys, new MemoryStateStore(), "dev-a", a, 1000);
    const summary = await sync(store, keys, new MemoryStateStore(), "dev-b", b, 2000);

    expect(summary.conflicts).toEqual([
      { namespace: "chats", id: "c1", title: "Theirs", reason: "diverged" },
    ]);
    expect(b.duplicates).toEqual([{ title: "Mine" }]);
    expect(b.data.get("c1")).toEqual({ title: "Theirs" });
  });

  it("pulls a remote edit when the local copy is unchanged", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "One" }]]);
    const b = fakeOf();
    const stateA = new MemoryStateStore();
    const stateB = new MemoryStateStore();

    await sync(store, keys, stateA, "dev-a", a, 1000);
    await sync(store, keys, stateB, "dev-b", b, 2000);

    a.data.set("c1", { title: "One, edited" });
    const push = await sync(store, keys, stateA, "dev-a", a, 3000);
    expect(push.pushed).toBe(1);

    const pull = await sync(store, keys, stateB, "dev-b", b, 4000);
    expect(pull.pulled).toBe(1);
    expect(b.data.get("c1")).toEqual({ title: "One, edited" });
  });

  it("duplicates a diverged version instead of blocking the sync", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "One" }]]);
    const b = fakeOf();
    const stateA = new MemoryStateStore();
    const stateB = new MemoryStateStore();

    await sync(store, keys, stateA, "dev-a", a, 1000);
    await sync(store, keys, stateB, "dev-b", b, 2000);

    a.data.set("c1", { title: "From A" });
    b.data.set("c1", { title: "From B" });

    await sync(store, keys, stateA, "dev-a", a, 3000);
    const summary = await sync(store, keys, stateB, "dev-b", b, 4000);

    expect(summary.conflicts).toHaveLength(1);
    expect(summary.conflicts[0]).toMatchObject({
      namespace: "chats",
      id: "c1",
      reason: "diverged",
    });
    expect(b.duplicates).toEqual([{ title: "From A" }]);
    expect(b.data.get("c1")).toEqual({ title: "From B" });

    // The device that duplicated then syncs again and adopts the newer remote.
    await sync(store, keys, stateA, "dev-a", a, 5000);
    expect(a.data.get("c1")).toEqual({ title: "From B" });
  });

  it("deletes a record another device still holds", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "One" }]]);
    const b = fakeOf();
    const stateA = new MemoryStateStore();
    const stateB = new MemoryStateStore();

    await sync(store, keys, stateA, "dev-a", a, 1000);
    await sync(store, keys, stateB, "dev-b", b, 2000);

    a.data.delete("c1");
    const deletion = await sync(store, keys, stateA, "dev-a", a, 3000);
    expect(deletion.deleted).toBe(1);

    const applied = await sync(store, keys, stateB, "dev-b", b, 4000);
    expect(applied.deleted).toBe(1);
    expect(b.removed).toEqual(["c1"]);
    expect(b.data.size).toBe(0);
  });

  it("resurrects a locally edited record that another device deleted", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "One" }]]);
    const b = fakeOf();
    const stateA = new MemoryStateStore();
    const stateB = new MemoryStateStore();

    await sync(store, keys, stateA, "dev-a", a, 1000);
    await sync(store, keys, stateB, "dev-b", b, 2000);

    a.data.delete("c1");
    await sync(store, keys, stateA, "dev-a", a, 3000);

    b.data.set("c1", { title: "Edited after the deletion" });
    await sync(store, keys, stateB, "dev-b", b, 4000);

    const back = await sync(store, keys, stateA, "dev-a", a, 5000);
    expect(back.pulled).toBe(1);
    expect(a.data.get("c1")).toEqual({ title: "Edited after the deletion" });
  });

  it("publishes one fragment per device and merges the union", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "One" }]]);
    const b = fakeOf([["c2", { title: "Two" }]]);

    await sync(store, keys, new MemoryStateStore(), "dev-a", a, 1000);
    await sync(store, keys, new MemoryStateStore(), "dev-b", b, 2000);

    const index = await readIndex(store, keys);
    expect(index.fragments).toBe(2);
    expect(index.unreadable).toBe(0);
    expect([...index.records.keys()].sort()).toEqual(["chats:c1", "chats:c2"]);
    expect(index.devices.size).toBe(2);
    expect(store.paths()).toEqual(
      expect.arrayContaining([
        `${SYNC_INDEX_DIR}/dev-a.bin`,
        `${SYNC_INDEX_DIR}/dev-b.bin`,
      ]),
    );
  });

  it("counts a fragment it cannot decrypt instead of failing the run", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    store.put(`${SYNC_INDEX_DIR}/dev-x.bin`, random(64));

    const index = await readIndex(store, keys);
    expect(index.fragments).toBe(0);
    expect(index.unreadable).toBe(1);

    const summary = await sync(
      store,
      keys,
      new MemoryStateStore(),
      "dev-a",
      fakeOf([["c1", { title: "One" }]]),
      1000,
    );
    expect(summary.pushed).toBe(1);
  });

  it("uploads an asset once and hands it back through readAsset", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const bytes = random(2048);
    const sha256 = sha256Hex(bytes);
    const seen: Uint8Array[] = [];
    const fake = fakeOf([["c1", { title: "With asset" }]]);
    const producer = {
      assets: [{ sha256, bytes }],
    };

    await runSync({
      store,
      keys,
      state: new MemoryStateStore(),
      deviceId: "dev-a",
      namespaces: [
        {
          ...makeNamespace(fake),
          async list() {
            const base = await makeNamespace(fake).list();
            return base.map((record) => ({ ...record, assets: producer.assets }));
          },
        } as any,
      ],
      now: 1000,
    });
    expect(store.paths()).toContain(`${SYNC_ASSETS_DIR}/${sha256}.bin`);
    const writesAfterFirst = store.writes.filter((path) => path.startsWith(SYNC_ASSETS_DIR));
    expect(writesAfterFirst).toHaveLength(1);

    const consumer = fakeOf();
    await runSync({
      store,
      keys,
      state: new MemoryStateStore(),
      deviceId: "dev-b",
      namespaces: [
        {
          ...makeNamespace(consumer),
          async apply(record: any, ctx: any) {
            seen.push(await ctx.readAsset(sha256));
            await makeNamespace(consumer).apply(record);
          },
        } as any,
      ],
      now: 2000,
    });
    expect(seen).toHaveLength(1);
    expect(equalBytes(seen[0], bytes)).toBe(true);
  });

  it("removes unreferenced revisions on explicit clean-up", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const a = fakeOf([["c1", { title: "One" }]]);

    await sync(store, keys, new MemoryStateStore(), "dev-a", a, 1000);
    const stale = `${SYNC_RECORDS_DIR}/chats/${recordFileName("c1", 999, "dev-z")}`;
    store.put(stale, random(32));

    const removed = await collectGarbage({ store, keys });
    expect(removed.records).toBe(1);
    expect(store.paths()).not.toContain(stale);
    expect(store.paths()).toContain(
      `${SYNC_RECORDS_DIR}/chats/${recordFileName("c1", 1000, "dev-a")}`,
    );
  });

  it("re-pushes a record when the fragment write failed after the upload", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const stateA = new MemoryStateStore();
    const a = fakeOf([["c1", { title: "One" }]]);

    await sync(store, keys, stateA, "dev-a", a, 1000);
    a.data.set("c1", { title: "Two" });

    // The record file is uploaded, then publishing this device's fragment
    // fails: a closed browser or a dropped connection at exactly that moment.
    await expect(
      sync(withFailingPublish(store), keys, stateA, "dev-a", a, 2000),
    ).rejects.toThrow("The network went away.");

    // The base still describes the pass that was actually published, so the
    // unpublished revision is not mistaken for an older remote one.
    expect(await stateA.get("chats", "c1")).toMatchObject({ rev: 1000 });

    const repaired = await sync(store, keys, stateA, "dev-a", a, 3000);
    expect(repaired.pushed).toBe(1);
    // Crucially, the newer local edit is not pulled back to "One".
    expect(a.data.get("c1")).toEqual({ title: "Two" });

    const b = fakeOf();
    await sync(store, keys, new MemoryStateStore(), "dev-b", b, 4000);
    expect(b.data.get("c1")).toEqual({ title: "Two" });
  });

  it("keeps a deletion when the fragment write failed after removing it locally", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const stateA = new MemoryStateStore();
    const stateB = new MemoryStateStore();
    const a = fakeOf([["c1", { title: "One" }]]);
    const b = fakeOf();

    await sync(store, keys, stateA, "dev-a", a, 1000);
    await sync(store, keys, stateB, "dev-b", b, 2000);
    a.data.delete("c1");

    await expect(
      sync(withFailingPublish(store), keys, stateA, "dev-a", a, 3000),
    ).rejects.toThrow("The network went away.");

    // The base row survived the failed publish, so the next pass still knows to
    // publish a tombstone instead of pulling the record back.
    const repaired = await sync(store, keys, stateA, "dev-a", a, 4000);
    expect(repaired.deleted).toBe(1);
    expect(a.data.has("c1")).toBe(false);

    const pull = await sync(store, keys, stateB, "dev-b", b, 5000);
    expect(pull.deleted).toBe(1);
    expect(b.data.has("c1")).toBe(false);
  });

  it("reports a record that cannot be read without abandoning the run", async () => {
    const keys = makeKeys();
    const store = new MemorySyncStore();
    const fake = fakeOf([["c1", { title: "One" }]]);
    await runSync({
      store,
      keys,
      state: new MemoryStateStore(),
      deviceId: "dev-a",
      namespaces: [
        {
          ...makeNamespace(fake),
          async apply() {
            throw new Error("broken record");
          },
        } as any,
      ],
      now: 1000,
    });

    const summary = await runSync({
      store,
      keys,
      state: new MemoryStateStore(),
      deviceId: "dev-b",
      namespaces: [
        {
          ...makeNamespace(fakeOf()),
          async apply() {
            throw new Error("broken record");
          },
        } as any,
      ],
      now: 2000,
    });
    expect(summary.skipped).toEqual(["chats/c1: broken record"]);
  });
});
