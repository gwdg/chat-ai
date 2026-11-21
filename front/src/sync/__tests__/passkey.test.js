import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { random } from "../crypto/bytes";
import {
  createPasskeyBinding,
  isPasskeyBinding,
  isPasskeySupported,
  passkeyKeysMatch,
  unwrapVaultKeysWithPasskey,
} from "../passkey";

/**
 * The WebAuthn ceremony is the only mocked part: the PRF output is the salt the
 * page asked for, which makes the wrapping deterministic while the real HKDF,
 * AES-GCM envelope and vault-key packing run unchanged.
 */
const keys = {
  vaultKey: random(32),
  blobKey: random(32),
  assetKey: random(32),
};

const credentialIdBytes = new Uint8Array([4, 2, 4, 2]).buffer;

const prfCredential = (first) => ({
  rawId: credentialIdBytes,
  getClientExtensionResults: () => ({ prf: { results: { first } } }),
});

let create;
let get;

const installWebAuthn = (
  options = {},
) => {
  create = vi.fn(async (request) => {
    const salt = request.publicKey.extensions.prf.eval.first;
    if (options.creationPrf === false) {
      return {
        rawId: credentialIdBytes,
        getClientExtensionResults: () => ({ prf: { enabled: true } }),
      };
    }
    return prfCredential(salt.buffer.slice(0));
  });
  get = vi.fn(async (request) => {
    const salt = request.publicKey.extensions.prf.eval.first;
    const first = options.getImpl ? options.getImpl(salt) : salt.buffer.slice(0);
    return prfCredential(first);
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

beforeEach(() => {
  installWebAuthn();
});

afterEach(() => {
  Object.defineProperty(navigator, "credentials", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(window, "PublicKeyCredential", {
    value: undefined,
    configurable: true,
  });
});

describe("passkey binding", () => {
  it("wraps and unwraps the three vault keys", async () => {
    const binding = await createPasskeyBinding(keys, "vault-1", "Work laptop");

    expect(isPasskeyBinding(binding)).toBe(true);
    expect(binding).toMatchObject({
      v: 1,
      vaultId: "vault-1",
      label: "Work laptop",
    });
    expect(binding.wrapped).not.toContain("vaultKey");
    // The PRF secret never leaves the authenticator, and the raw keys are not
    // in the binding.
    expect(JSON.stringify(binding)).not.toContain(
      Array.from(keys.vaultKey).join(","),
    );

    const unwrapped = await unwrapVaultKeysWithPasskey(binding, "vault-1");
    expect(passkeyKeysMatch(unwrapped, keys)).toBe(true);
  });

  it("asserts once at creation when the authenticator reports only prf.enabled", async () => {
    installWebAuthn({ creationPrf: false });

    const binding = await createPasskeyBinding(keys, "vault-2", "Phone");

    expect(create).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(
      passkeyKeysMatch(
        await unwrapVaultKeysWithPasskey(binding, "vault-2"),
        keys,
      ),
    ).toBe(true);
  });

  it("refuses a binding that belongs to another vault", async () => {
    const binding = await createPasskeyBinding(keys, "vault-3", "Laptop");

    await expect(
      unwrapVaultKeysWithPasskey(binding, "vault-other"),
    ).rejects.toMatchObject({ code: "MISMATCH" });
    // No prompt for a vault the binding can never open.
    expect(get).not.toHaveBeenCalled();
  });

  it("reports a dismissed prompt as a cancellation", async () => {
    create.mockRejectedValueOnce(
      new DOMException("The operation is not allowed.", "NotAllowedError"),
    );

    await expect(
      createPasskeyBinding(keys, "vault-4", "Laptop"),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("fails when the passkey does not reproduce the PRF secret", async () => {
    installWebAuthn({ getImpl: () => random(32).buffer });
    const binding = await createPasskeyBinding(keys, "vault-5", "Laptop");

    await expect(
      unwrapVaultKeysWithPasskey(binding, "vault-5"),
    ).rejects.toMatchObject({ code: "FAILED" });
  });

  it("reports an environment without WebAuthn", async () => {
    Object.defineProperty(navigator, "credentials", {
      value: undefined,
      configurable: true,
    });

    expect(isPasskeySupported()).toBe(false);
    await expect(
      createPasskeyBinding(keys, "vault-6", "Laptop"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });
});
