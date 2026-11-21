import { describe, expect, it } from "vitest";

import { hashPayload } from "../../sync/canonical";
import {
  backupFileName,
  createBackup,
  inspectBackup,
  restoreBackup,
} from "../package";

/**
 * The package is tested without Dexie or Redux: the archive only knows the
 * namespace contract, so a plain `Map` per namespace stands in for the database.
 */
const FAST_ARGON = { t: 1, m: 1024, p: 1 };
const PASSPHRASE = "correct horse battery staple";
const AT = Date.UTC(2026, 10, 21, 10, 30, 15);

type FakeNamespace = {
  name: string;
  data: Map<string, any>;
  assets: Map<string, Uint8Array>;
  skipped: string[];
  applied: string[];
};

const fake = (name: string): FakeNamespace => ({
  name,
  data: new Map(),
  assets: new Map(),
  skipped: [],
  applied: [],
});

const namespaceOf = (store: FakeNamespace) => ({
  name: store.name,
  async list() {
    return [...store.data.entries()].map(([id, payload]) => {
      const fileSha = payload.fileSha;
      return {
        namespace: store.name,
        id,
        hash: hashPayload(payload),
        payload,
        title: payload.title,
        assets: fileSha
          ? [{ sha256: fileSha, bytes: store.assets.get(fileSha)! }]
          : [],
      };
    });
  },
  async apply(record: any, ctx: any) {
    const payload = { ...record.payload };
    if (payload.fileSha) {
      const bytes = await ctx.readAsset(payload.fileSha);
      payload.fileBytes = bytes ? [...bytes] : null;
    }
    store.data.set(record.id, payload);
    store.applied.push(record.id);
  },
  takeSkipped() {
    const out = store.skipped;
    store.skipped = [];
    return out;
  },
});

const setup = () => {
  const settings = fake("settings");
  const folders = fake("folders");
  const conversations = fake("conversations");
  settings.data.set("user-settings", { title: "Settings", dark_mode: true });
  folders.data.set("topic-1", { title: "Topic", name: "Topic" });
  conversations.data.set("chat-1", { title: "Secret chat title", fileSha: "sha-1" });
  conversations.data.set("chat-2", { title: "An empty chat" });
  const bytes = new TextEncoder().encode("attachment bytes");
  conversations.assets.set("sha-1", bytes);
  return {
    stores: { settings, folders, conversations },
    namespaces: [
      namespaceOf(settings),
      namespaceOf(folders),
      namespaceOf(conversations),
    ],
    bytes,
  };
};

const create = (options = {}) =>
  createBackup(PASSPHRASE, {
    namespaces: options.namespaces,
    now: AT,
    argon: FAST_ARGON,
    ...options,
  });

describe("encrypted backup package", () => {
  it("seals the whole history into one dated file", async () => {
    const { namespaces } = setup();
    const result = await create({ namespaces });

    expect(result.createdAt).toBe(AT);
    expect(result.fileName).toBe(backupFileName(AT));
    expect(result.fileName).toMatch(
      /^chat-ai-backup-\d{8}-\d{6}\.chataibackup$/,
    );
    expect(result.records).toBe(4);
    // One shared attachment, deduplicated across records.
    expect(result.assets).toBe(1);
    expect(result.counts).toMatchObject({
      records: 4,
      assets: 1,
      settings: 1,
      folders: 1,
      conversations: 2,
    });

    const container = JSON.parse(result.text);
    expect(container.format).toBe("chat-ai-backup");
    expect(container.version).toBe(1);
    expect(container.createdAt).toBe(AT);
    expect(container.kdf.alg).toBe("argon2id");
    // The chat title is inside the sealed payload, never in the clear header.
    expect(result.text).not.toContain("Secret chat title");

    expect(inspectBackup(result.text)).toMatchObject({
      createdAt: AT,
      counts: { records: 4, assets: 1 },
    });
  });

  it("restores every namespace and its attachments with the same passphrase", async () => {
    const source = setup();
    const result = await create({ namespaces: source.namespaces });

    const target = setup();
    target.stores.settings.data.clear();
    target.stores.folders.data.clear();
    target.stores.conversations.data.clear();

    const restored = await restoreBackup(result.text, PASSPHRASE, {
      namespaces: target.namespaces,
    });

    expect(restored.records).toBe(4);
    expect(restored.applied).toEqual({
      settings: 1,
      folders: 1,
      conversations: 2,
    });
    expect(target.stores.settings.data.get("user-settings")).toMatchObject({
      dark_mode: true,
    });
    expect(target.stores.folders.data.get("topic-1")).toMatchObject({
      name: "Topic",
    });
    const chat = target.stores.conversations.data.get("chat-1");
    expect(chat.fileBytes).toEqual([...source.bytes]);
    // Settings are applied first, so later namespaces can rely on them.
    expect(target.stores.settings.applied).toEqual(["user-settings"]);
    expect(restored.unknownNamespaces).toEqual([]);
  });

  it("rejects a wrong passphrase without writing anything", async () => {
    const { namespaces } = setup();
    const result = await create({ namespaces });

    const target = setup();
    target.stores.conversations.data.clear();

    await expect(
      restoreBackup(result.text, "not the passphrase", {
        namespaces: target.namespaces,
      }),
    ).rejects.toMatchObject({ code: "WRONG_PASSPHRASE" });
    expect(target.stores.conversations.data.size).toBe(0);
    expect(target.stores.conversations.applied).toEqual([]);
  });

  it("refuses a tampered payload", async () => {
    const { namespaces } = setup();
    const result = await create({ namespaces });
    const container = JSON.parse(result.text);
    const chars = container.payload.split("");
    chars[10] = chars[10] === "A" ? "B" : "A";
    container.payload = chars.join("");

    await expect(
      restoreBackup(JSON.stringify(container), PASSPHRASE, {
        namespaces: setup().namespaces,
      }),
    ).rejects.toMatchObject({ code: "WRONG_PASSPHRASE" });
  });

  it("rejects a file that is not a backup or comes from a newer version", async () => {
    await expect(
      restoreBackup("not json", PASSPHRASE, {
        namespaces: setup().namespaces,
      }),
    ).rejects.toMatchObject({ code: "INVALID_BACKUP" });

    await expect(
      restoreBackup(
        JSON.stringify({
          format: "chat-ai-backup",
          version: 99,
          createdAt: AT,
          payload: "AAAA",
        }),
        PASSPHRASE,
        { namespaces: setup().namespaces },
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_VERSION" });
  });

  it("enforces the shared minimum passphrase length", async () => {
    await expect(
      createBackup("short", { namespaces: setup().namespaces, argon: FAST_ARGON }),
    ).rejects.toMatchObject({ code: "PASSPHRASE_TOO_SHORT" });
  });

  it("reports namespaces this version does not know instead of guessing", async () => {
    const future = fake("future-namespace");
    future.data.set("future-1", { title: "From a newer build" });
    const result = await create({ namespaces: [namespaceOf(future)] });

    const restored = await restoreBackup(result.text, PASSPHRASE, {
      namespaces: setup().namespaces,
    });

    expect(restored.unknownNamespaces).toEqual(["future-namespace"]);
    expect(restored.applied).toEqual({});
  });

  it("carries skipped files from creation into the restore report", async () => {
    const { namespaces, stores } = setup();
    stores.conversations.skipped = ["too-big.bin (9000000 bytes)"];
    const result = await create({ namespaces });
    expect(result.skipped).toEqual(["too-big.bin (9000000 bytes)"]);

    const target = setup();
    const restored = await restoreBackup(result.text, PASSPHRASE, {
      namespaces: target.namespaces,
    });
    expect(restored.skipped).toContain("too-big.bin (9000000 bytes)");
  });
});
