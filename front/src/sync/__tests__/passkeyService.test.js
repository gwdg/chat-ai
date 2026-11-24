import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MemorySyncStore } from "../storage/memoryStore";
import { MemoryStateStore } from "./memoryStateStore";
import { createVault } from "../crypto/vault";
import { writeVaultHeader } from "../engine";
import {
  changeSyncPassphrase,
  configureSyncDeps,
  createSyncVault,
  didPasskeyUnlockSession,
  forgetSyncPasskey,
  getSyncPasskeyLabel,
  getSyncStatus,
  hasSyncPasskey,
  loadSyncStatus,
  lockSyncVault,
  registerSyncPasskey,
  resetSyncServiceForTests,
  setSyncPreferences,
  unlockSyncVault,
  unlockSyncVaultWithPasskey,
} from "../service";

/**
 * Passkey enrolment in the service: the WebAuthn ceremony is stubbed to return
 * the requested salt as the PRF secret, so the key wrapping is real.
 */
const PASSPHRASE = "a long enough passphrase";
const credentialIdBytes = new Uint8Array([1, 2, 3]).buffer;

const prfCredential = (first) => ({
  rawId: credentialIdBytes,
  getClientExtensionResults: () => ({ prf: { results: { first } } }),
});

let create;
let get;

const installWebAuthn = () => {
  create = vi.fn(async (request) => {
    const salt = request.publicKey.extensions.prf.eval.first;
    return prfCredential(salt.buffer.slice(0));
  });
  get = vi.fn(async (request) => {
    const salt = request.publicKey.extensions.prf.eval.first;
    return prfCredential(salt.buffer.slice(0));
  });
  Object.defineProperty(navigator, "credentials", {
    value: { create, get },
    configurable: true,
  });
  Object.defineProperty(window, "PublicKeyCredential", {
    value: function PublicKeyCredential() {},
    configurable: true,
  });
};

const uninstallWebAuthn = () => {
  Object.defineProperty(navigator, "credentials", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(window, "PublicKeyCredential", {
    value: undefined,
    configurable: true,
  });
};

const setup = async () => {
  const store = new MemorySyncStore();
  const state = new MemoryStateStore();
  configureSyncDeps({ createStore: () => store, state, namespaces: () => [] });
  const vault = await createVault(PASSPHRASE, {
    argon: { t: 1, m: 1024, p: 1 },
  });
  await writeVaultHeader(store, vault.header);
  await unlockSyncVault(PASSPHRASE);
  return { store, state, vault };
};

beforeEach(() => {
  installWebAuthn();
});

afterEach(() => {
  resetSyncServiceForTests();
  uninstallWebAuthn();
});

describe("sync passkey", () => {
  it("enrols a passkey and unlocks the vault with it after a lock", async () => {
    const { state, vault } = await setup();
    const fingerprint = getSyncStatus().fingerprint;

    const enrolled = await registerSyncPasskey("Work laptop");
    expect(enrolled.passkey).toBe(true);
    expect(enrolled.passkeyLabel).toBe("Work laptop");
    expect(await hasSyncPasskey()).toBe(true);
    expect(await getSyncPasskeyLabel()).toBe("Work laptop");
    expect(await state.getMeta("passkey-binding")).toMatchObject({
      vaultId: vault.header.vaultId,
      label: "Work laptop",
    });

    lockSyncVault();
    expect(getSyncStatus().unlocked).toBe(false);
    expect(getSyncStatus().passkey).toBe(true);

    const unlocked = await unlockSyncVaultWithPasskey();
    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.fingerprint).toBe(fingerprint);
    // The explicit click used the passkey, not a hidden passphrase.
    expect(get).toHaveBeenCalled();
  });

  it("remembers the passkey unlock for the browser session", async () => {
    const { vault } = await setup();
    await registerSyncPasskey("Laptop");
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(true);

    // The hint is display state for the Data tab, not a precondition for the
    // automatic attempt; an explicit lock only clears the message.
    lockSyncVault();
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(false);

    await unlockSyncVaultWithPasskey();
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(true);
  });

  it("restores the passkey flag after a reload", async () => {
    const { state } = await setup();
    await registerSyncPasskey("Laptop");

    // A reload drops the module state but keeps Dexie.
    resetSyncServiceForTests();
    configureSyncDeps({ state, namespaces: () => [] });
    const restored = await loadSyncStatus();

    expect(restored.passkey).toBe(true);
    expect(restored.passkeyLabel).toBe("Laptop");
    expect(restored.configured).toBe(true);
  });

  it("forgets the passkey without touching the vault", async () => {
    const { state, vault } = await setup();
    await registerSyncPasskey("Laptop");

    await forgetSyncPasskey();

    expect(getSyncStatus().passkey).toBe(false);
    expect(await state.getMeta("passkey-binding")).toBeUndefined();
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(false);
    // The passphrase still opens it.
    lockSyncVault();
    const unlocked = await unlockSyncVault(PASSPHRASE);
    expect(unlocked.unlocked).toBe(true);
  });

  it("drops the binding when the vault is replaced", async () => {
    const { vault } = await setup();
    await registerSyncPasskey("Laptop");
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(true);

    const replaced = await createSyncVault("another long passphrase", {
      replace: true,
    });
    expect(replaced.passkey).toBe(false);
    expect(replaced.passkeyLabel).toBe(null);
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(false);
    // No stale binding may open the new header.
    await expect(unlockSyncVaultWithPasskey()).rejects.toMatchObject({
      code: "MISMATCH",
    });
  }, 15_000);

  it("reports a missing binding without prompting", async () => {
    const { vault } = await setup();
    lockSyncVault();

    await expect(unlockSyncVaultWithPasskey()).rejects.toMatchObject({
      code: "MISMATCH",
    });
    expect(get).not.toHaveBeenCalled();
    expect(getSyncStatus().unlocked).toBe(false);
    // The session hint is absent, so a reload does not keep trying.
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(false);
  });

  it("shares one prompt between concurrent unlock attempts", async () => {
    await setup();
    await registerSyncPasskey("Laptop");
    lockSyncVault();
    get.mockClear();

    const [first, second] = await Promise.all([
      unlockSyncVaultWithPasskey(),
      unlockSyncVaultWithPasskey(),
    ]);

    // The app-level hook and the Data panel both ask after a reload; two
    // WebAuthn calls would be two dialogs.
    expect(get).toHaveBeenCalledTimes(1);
    expect(first.unlocked).toBe(true);
    expect(second.unlocked).toBe(true);
  });

  it("does not pop the authenticator again after an explicit lock", async () => {
    await setup();
    await registerSyncPasskey("Laptop");
    lockSyncVault();
    get.mockClear();

    // The automatic attempt after a page mount is silent; "Lock now" wins for
    // the rest of this app session.
    await expect(
      unlockSyncVaultWithPasskey({ silent: true }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(get).not.toHaveBeenCalled();
    expect(getSyncStatus().unlocked).toBe(false);

    // The visible button is not suppressed.
    const unlocked = await unlockSyncVaultWithPasskey();
    expect(unlocked.unlocked).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("re-arms the silent attempt when the synchronization is switched on again", async () => {
    await setup();
    await registerSyncPasskey("Laptop");
    setSyncPreferences({ enabled: true });
    lockSyncVault();
    get.mockClear();

    await expect(
      unlockSyncVaultWithPasskey({ silent: true }),
    ).rejects.toMatchObject({ code: "CANCELLED" });

    // Switching off and on is an explicit choice, so the next mount may ask.
    setSyncPreferences({ enabled: false });
    setSyncPreferences({ enabled: true });
    const unlocked = await unlockSyncVaultWithPasskey({ silent: true });
    expect(unlocked.unlocked).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("keeps the passkey after a passphrase change", async () => {
    const { vault } = await setup();
    await registerSyncPasskey("Laptop");
    // changeSyncPassphrase rewraps the same vault key, so the passkey survives.
    await changeSyncPassphrase("a different long passphrase");
    expect(await hasSyncPasskey()).toBe(true);
    expect(didPasskeyUnlockSession(vault.header.vaultId)).toBe(true);
  });
});
