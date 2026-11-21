import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import SyncSettings from "../SyncSettings";

// The module flag is what gates the section; the service is stubbed so the test
// does not touch SAIA fs or Argon2.
const modules = vi.hoisted(() => ({ isSyncEnabled: vi.fn(() => true) }));
const service = vi.hoisted(() => ({
  changeSyncPassphrase: vi.fn(),
  cleanUpRemote: vi.fn(),
  createSyncVault: vi.fn(),
  didPasskeyUnlockSession: vi.fn(() => false),
  forgetSyncPasskey: vi.fn(async () => {}),
  hasRemoteVault: vi.fn(),
  lockSyncVault: vi.fn(),
  registerSyncPasskey: vi.fn(async () => ({})),
  rotateSyncVault: vi.fn(),
  runSyncIfUnlocked: vi.fn(),
  syncNow: vi.fn(),
  unlockSyncVault: vi.fn(async () => ({})),
  unlockSyncVaultWithPasskey: vi.fn(async () => ({})),
}));
const engine = vi.hoisted(() => ({
  status: {
    enabled: true,
    configured: false,
    unlocked: false,
    passkey: false,
    passkeyLabel: null,
    passkeySupported: false,
    running: false,
    deviceId: null,
    vaultId: null,
    fingerprint: null,
    lastRunAt: null,
    lastSummary: null,
    conflicts: 0,
    skipped: 0,
    error: null,
    progress: null,
  },
}));

vi.mock("../../../utils/modules", () => ({
  isSyncEnabled: modules.isSyncEnabled,
}));
vi.mock("../../../sync/service", () => service);
vi.mock("../../../hooks/useSyncEngine", () => ({
  useSyncEngine: () => engine.status,
}));

const makeStore = () =>
  configureStore({ reducer: { user_settings: userSettingsReducer } });

const renderSection = (store = makeStore()) => {
  const view = render(
    <Provider store={store}>
      <SyncSettings />
    </Provider>,
  );
  return { store, view };
};

beforeEach(() => {
  modules.isSyncEnabled.mockReturnValue(true);
  engine.status.unlocked = false;
  engine.status.configured = false;
  engine.status.passkey = false;
  engine.status.passkeyLabel = null;
  engine.status.passkeySupported = false;
  engine.status.vaultId = null;
  service.didPasskeyUnlockSession.mockReset();
  service.didPasskeyUnlockSession.mockReturnValue(false);
  service.forgetSyncPasskey.mockClear();
  service.registerSyncPasskey.mockClear();
  service.unlockSyncVaultWithPasskey.mockClear();
  service.hasRemoteVault.mockReset();
  service.hasRemoteVault.mockResolvedValue(false);
  service.createSyncVault.mockReset();
  service.createSyncVault.mockResolvedValue({});
  service.unlockSyncVault.mockReset();
  service.unlockSyncVault.mockResolvedValue({});
});

describe("SyncSettings", () => {
  it("renders nothing while the sync module is off", () => {
    modules.isSyncEnabled.mockReturnValue(false);
    const { view } = renderSection();
    expect(view.container).toBeEmptyDOMElement();
  });

  it("shows the encryption notice and switches the server synchronization on", () => {
    const { store } = renderSection();
    expect(screen.getByText(/cannot read the copy/i)).toBeInTheDocument();

    const toggle = screen.getByRole("switch", {
      name: /encrypted copy on my SAIA filesystem/i,
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(store.getState().user_settings.sync.enabled).toBe(true);
  });

  it("offers Create when the account has no copy yet", async () => {
    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument(),
    );
    expect(service.hasRemoteVault).toHaveBeenCalled();
  });

  it("offers Unlock when another device already created a copy", async () => {
    service.hasRemoteVault.mockResolvedValue(true);
    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument(),
    );
  });

  it("reports a failed unlock directly under the unlock button", async () => {
    service.hasRemoteVault.mockResolvedValue(true);
    service.unlockSyncVault.mockRejectedValueOnce(new Error("Wrong passphrase."));
    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    const unlockButton = await screen.findByRole("button", { name: /^unlock$/i });
    fireEvent.change(screen.getByLabelText(/^passphrase$/i), {
      target: { value: "a wrong long passphrase" },
    });
    fireEvent.click(unlockButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/wrong passphrase/i);
    // The failure belongs to the button that caused it, not to the bottom of
    // the whole section where it would be out of view.
    expect(
      unlockButton.compareDocumentPosition(alert) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lets a locked account replace the vault with a confirmed passphrase", async () => {
    service.hasRemoteVault.mockResolvedValue(true);
    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/^passphrase$/i), {
      target: { value: "a new long passphrase" },
    });
    fireEvent.change(screen.getByLabelText(/repeat passphrase/i), {
      target: { value: "a new long passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /replace the vault/i }));

    await waitFor(() =>
      expect(service.createSyncVault).toHaveBeenCalledWith(
        "a new long passphrase",
        { replace: true },
      ),
    );
  });

  it("checks the remote again after the vault locks", async () => {
    engine.status.unlocked = true;
    const { store, view } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sync now/i })).toBeInTheDocument(),
    );
    expect(service.hasRemoteVault).not.toHaveBeenCalled();

    engine.status.unlocked = false;
    view.rerender(
      <Provider store={store}>
        <SyncSettings />
      </Provider>,
    );

    await waitFor(() =>
      expect(service.hasRemoteVault).toHaveBeenCalledTimes(1),
    );
  });

  it("asks for the passkey when the switch is turned on, without a session hint", async () => {
    engine.status.configured = true;
    engine.status.vaultId = "vault-1";
    engine.status.passkey = true;
    engine.status.passkeySupported = true;
    service.didPasskeyUnlockSession.mockReturnValue(false);

    renderSection();
    fireEvent.click(
      screen.getByRole("switch", {
        name: /encrypted copy on my SAIA filesystem/i,
      }),
    );

    // Turning the synchronization on is a user gesture, so a device that
    // already holds the passkey opens the vault instead of showing the
    // passphrase form.
    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith({
        silent: true,
      }),
    );
  });

  it("does not ask automatically while the automatic sync is paused", () => {
    engine.status.configured = true;
    engine.status.vaultId = "vault-1";
    engine.status.passkey = true;
    engine.status.passkeySupported = true;

    const store = configureStore({
      reducer: { user_settings: userSettingsReducer },
      preloadedState: {
        user_settings: {
          ...userSettingsReducer(undefined, { type: "@@INIT" }),
          sync: { enabled: true, auto: false },
        },
      },
    });
    renderSection(store);

    // Nothing runs on its own, so no authenticator prompt either; the explicit
    // button below and the sidebar's "Sync now" stay available.
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /unlock with passkey/i }),
    ).toBeInTheDocument();
  });

  it("talks to the authenticator again after the automatic sync is resumed", () => {
    engine.status.configured = true;
    engine.status.vaultId = "vault-1";
    engine.status.passkey = true;
    engine.status.passkeySupported = true;

    const store = configureStore({
      reducer: { user_settings: userSettingsReducer },
      preloadedState: {
        user_settings: {
          ...userSettingsReducer(undefined, { type: "@@INIT" }),
          sync: { enabled: true, auto: false },
        },
      },
    });
    const { view } = renderSection(store);
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();

    store.dispatch({ type: "user_settings/setSyncAuto", payload: true });
    view.rerender(
      <Provider store={store}>
        <SyncSettings />
      </Provider>,
    );

    expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith({
      silent: true,
    });
  });

  it("asks for the passkey automatically in a new tab", async () => {
    engine.status.configured = true;
    engine.status.vaultId = "vault-1";
    engine.status.passkey = true;
    engine.status.passkeySupported = true;
    // Nothing in this browser session used the passkey yet.
    service.didPasskeyUnlockSession.mockReturnValue(false);

    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith({
        silent: true,
      }),
    );
    expect(
      await screen.findByRole("button", { name: /unlock with passkey/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your browser asks for the passkey/i),
    ).toBeInTheDocument();
  });

  it("explains that this session already used the passkey", async () => {
    engine.status.configured = true;
    engine.status.vaultId = "vault-1";
    engine.status.passkey = true;
    engine.status.passkeySupported = true;
    service.didPasskeyUnlockSession.mockReturnValue(true);

    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    // The hint is display state only; the automatic attempt no longer depends
    // on it, which is why this renders in a fresh tab as well.
    expect(
      await screen.findByText(/this session unlocked with a passkey/i),
    ).toBeInTheDocument();
  });

  it("unlocks with the passkey from the explicit button", async () => {
    engine.status.configured = true;
    engine.status.vaultId = "vault-1";
    engine.status.passkey = true;
    engine.status.passkeySupported = true;

    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    fireEvent.click(
      await screen.findByRole("button", { name: /unlock with passkey/i }),
    );

    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith(),
    );
  });

  it("adds a passkey from the unlocked panel", async () => {
    engine.status.unlocked = true;
    engine.status.passkeySupported = true;

    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    fireEvent.change(
      await screen.findByRole("textbox", { name: /passkey name/i }),
      { target: { value: "Work laptop" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /add a passkey/i }));

    await waitFor(() =>
      expect(service.registerSyncPasskey).toHaveBeenCalledWith("Work laptop"),
    );
  });

  it("forgets an enrolled passkey", async () => {
    engine.status.unlocked = true;
    engine.status.passkey = true;
    engine.status.passkeyLabel = "Work laptop";
    engine.status.passkeySupported = true;

    const { store } = renderSection();
    store.dispatch({ type: "user_settings/setSyncEnabled", payload: true });

    expect(await screen.findByText(/enrolled: work laptop/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /forget this passkey/i }),
    );

    await waitFor(() =>
      expect(service.forgetSyncPasskey).toHaveBeenCalledTimes(1),
    );
  });
});
