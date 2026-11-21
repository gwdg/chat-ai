import { afterEach, describe, expect, it, vi } from "vitest";

import { MemorySyncStore } from "../storage/memoryStore";
import { MemoryStateStore } from "./memoryStateStore";
import { createVault } from "../crypto/vault";
import { writeVaultHeader, readVaultHeader, SYNC_VAULT_PATH } from "../engine";
import {
  changeSyncPassphrase,
  cleanUpRemote,
  configureSyncDeps,
  createSyncVault,
  getSyncStatus,
  hasRemoteVault,
  loadSyncStatus,
  lockSyncVault,
  remoteVaultSummary,
  resetSyncServiceForTests,
  rotateSyncVault,
  setSyncPreferences,
  subscribeSyncStatus,
  syncNow,
  unlockSyncVault,
} from "../service";

/**
 * The service keeps no key material on disk: these tests assert the lifecycle
 * and that a locked vault refuses to sync, not the crypto (see crypto.test).
 */
const PASSPHRASE = "a long enough passphrase";

const setup = async () => {
  const store = new MemorySyncStore();
  const state = new MemoryStateStore();
  configureSyncDeps({
    createStore: () => store,
    state,
    namespaces: () => [],
  });
  return { store, state };
};

afterEach(() => {
  resetSyncServiceForTests();
});

describe("sync service", () => {
  it("creates a vault, locks it and unlocks it again", async () => {
    const { store, state } = await setup();

    const created = await createSyncVault(PASSPHRASE);
    expect(created.unlocked).toBe(true);
    expect(created.configured).toBe(true);
    expect(created.fingerprint).toBeTruthy();
    expect(await store.exists(SYNC_VAULT_PATH)).toBe(true);
    // Only the cleartext header is stored; the key is only in memory.
    const header = await readVaultHeader(store);
    expect(header?.vaultId).toBeTruthy();
    expect(JSON.stringify(header)).not.toContain("vaultKey");

    const cached = await state.getMeta("vault-header");
    expect(cached?.vaultId).toBe(header?.vaultId);

    lockSyncVault();
    expect(getSyncStatus().unlocked).toBe(false);
    await expect(syncNow()).rejects.toMatchObject({ code: "PASSPHRASE_REQUIRED" });

    const unlocked = await unlockSyncVault(PASSPHRASE);
    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.fingerprint).toBe(created.fingerprint);
  });

  it("reports a wrong passphrase and keeps the vault locked", async () => {
    const { store } = await setup();
    const vault = await createVault(PASSPHRASE, { argon: { t: 1, m: 1024, p: 1 } });
    await writeVaultHeader(store, vault.header);

    await expect(unlockSyncVault("not the passphrase")).rejects.toMatchObject({
      code: "WRONG_PASSPHRASE",
    });
    expect(getSyncStatus().unlocked).toBe(false);
    expect(getSyncStatus().error).toMatch(/does not open/);
  });

  it("refuses to create a second vault unless it is a replacement", async () => {
    const { store } = await setup();
    const vault = await createVault(PASSPHRASE, { argon: { t: 1, m: 1024, p: 1 } });
    await writeVaultHeader(store, vault.header);
    expect(await hasRemoteVault()).toBe(true);

    await expect(createSyncVault(PASSPHRASE)).rejects.toMatchObject({
      code: "INVALID_VAULT",
    });

    const replaced = await createSyncVault(PASSPHRASE, { replace: true });
    expect(replaced.unlocked).toBe(true);
    const header = await readVaultHeader(store);
    expect(header?.vaultId).not.toBe(vault.header.vaultId);
  });

  it(
    "rotates the vault and re-uploads under the new key",
    async () => {
      const { store } = await setup();
      const vault = await createVault(PASSPHRASE, {
        argon: { t: 1, m: 1024, p: 1 },
      });
      await writeVaultHeader(store, vault.header);
      await unlockSyncVault(PASSPHRASE);
      const first = await readVaultHeader(store);
      await syncNow();
      expect((await remoteVaultSummary())?.fragments).toBe(1);

      const rotated = await rotateSyncVault("a different long passphrase");
      expect(rotated.unlocked).toBe(true);
      const second = await readVaultHeader(store);
      expect(second?.vaultId).not.toBe(first?.vaultId);

      await syncNow();
      // The old index fragment is still on the filesystem but no longer opens.
      expect(await remoteVaultSummary()).toMatchObject({
        fragments: 1,
        unreadable: 1,
      });

      lockSyncVault();
      await expect(unlockSyncVault(PASSPHRASE)).rejects.toMatchObject({
        code: "WRONG_PASSPHRASE",
      });
      await unlockSyncVault("a different long passphrase");
      expect(getSyncStatus().unlocked).toBe(true);
    },
    15000,
  );

  it("changes the passphrase without re-encrypting the archive", async () => {
    const { store } = await setup();
    const vault = await createVault(PASSPHRASE, { argon: { t: 1, m: 1024, p: 1 } });
    await writeVaultHeader(store, vault.header);
    await unlockSyncVault(PASSPHRASE);
    const fingerprint = getSyncStatus().fingerprint;

    await changeSyncPassphrase("a different long passphrase");
    const header = await readVaultHeader(store);
    expect(header?.vaultId).toBe(vault.header.vaultId);
    expect(getSyncStatus().fingerprint).toBe(fingerprint);

    lockSyncVault();
    await expect(unlockSyncVault(PASSPHRASE)).rejects.toMatchObject({
      code: "WRONG_PASSPHRASE",
    });
    await unlockSyncVault("a different long passphrase");
    expect(getSyncStatus().unlocked).toBe(true);
  });

  it("runs a pass, reports the remote and cleans up", async () => {
    const { store, state } = await setup();
    const vault = await createVault(PASSPHRASE, { argon: { t: 1, m: 1024, p: 1 } });
    await writeVaultHeader(store, vault.header);
    await unlockSyncVault(PASSPHRASE);

    const summary = await syncNow();
    expect(summary).toMatchObject({
      pulled: 0,
      pushed: 0,
      deleted: 0,
      conflicts: [],
      skipped: [],
    });
    expect(await state.getMeta("last-summary")).toMatchObject({ at: summary.at });

    const remote = await remoteVaultSummary();
    expect(remote).toMatchObject({ devices: 1, fragments: 1, records: 0 });

    const removed = await cleanUpRemote();
    expect(removed).toEqual({ records: 0, assets: 0 });
  });

  it("restores the cached status after a reload, with the vault still locked", async () => {
    const { state } = await setup();
    await state.setMeta("vault-header", {
      v: 1,
      vaultId: "vault-1",
      kdf: {
        alg: "argon2id",
        t: 1,
        m: 1024,
        p: 1,
        dkLen: 32,
        salt: "c2FsdA",
      },
      wrapped: { iv: "aXY", ct: "Y3Q" },
      createdAt: 1,
    });
    await state.setMeta("deviceId", "dev-a");
    await state.setMeta("last-summary", {
      at: 123,
      pulled: 1,
      pushed: 0,
      deleted: 0,
      conflicts: [],
      skipped: [],
    });

    const status = await loadSyncStatus();
    expect(status.configured).toBe(true);
    expect(status.unlocked).toBe(false);
    expect(status.deviceId).toBe("dev-a");
    expect(status.lastRunAt).toBe(123);
  });

  // The engine reads the two switches from here, never from Redux: the store is
  // only reachable through a lazy import, so a sidebar test that imports the
  // modal context does not construct `redux-state-sync`.
  it("follows the preferences the hook feeds in", async () => {
    await setup();
    const seen = [];
    const unsubscribe = subscribeSyncStatus((next) => seen.push(next.enabled));

    setSyncPreferences({ enabled: true, auto: false });
    expect(getSyncStatus().enabled).toBe(true);
    expect(seen.at(-1)).toBe(true);

    setSyncPreferences({ enabled: false });
    expect(getSyncStatus().enabled).toBe(false);
    expect(seen.at(-1)).toBe(false);
    unsubscribe();
  });
});
