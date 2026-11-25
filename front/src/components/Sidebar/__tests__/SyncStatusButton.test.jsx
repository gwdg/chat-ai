import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import SyncStatusButton from "../SyncStatusButton";

const modules = vi.hoisted(() => ({ isSyncEnabled: vi.fn(() => true) }));
const engine = vi.hoisted(() => ({ useSyncEngine: vi.fn() }));
const service = vi.hoisted(() => ({
  syncNow: vi.fn(),
  unlockSyncVaultWithPasskey: vi.fn(),
}));
const toast = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../utils/modules", () => ({
  isSyncEnabled: modules.isSyncEnabled,
}));
vi.mock("../../../hooks/useSyncEngine", () => ({
  useSyncEngine: engine.useSyncEngine,
}));
vi.mock("../../../sync/service", () => service);
vi.mock("../../../hooks/useToast", () => ({ useToast: () => toast }));

const status = (overrides = {}) => ({
  enabled: true,
  configured: true,
  unlocked: true,
  running: false,
  deviceId: "device-1",
  vaultId: "vault-1",
  fingerprint: "fingerprint",
  lastRunAt: null,
  lastSummary: null,
  conflicts: 0,
  skipped: 0,
  error: null,
  progress: null,
  ...overrides,
});

const renderButton = (sync = { enabled: true, auto: true }) => {
  const store = configureStore({
    reducer: { user_settings: userSettingsReducer },
    preloadedState: { user_settings: { ...userSettingsReducer(undefined, { type: "@@INIT" }), sync } },
  });
  const onOpenSettings = vi.fn();
  const view = render(
    <Provider store={store}>
      <SyncStatusButton onOpenSettings={onOpenSettings} />
    </Provider>,
  );
  return { view, store, onOpenSettings };
};

beforeEach(() => {
  modules.isSyncEnabled.mockReturnValue(true);
  engine.useSyncEngine.mockReturnValue(status());
  service.syncNow.mockReset();
  service.syncNow.mockResolvedValue({
    at: Date.now(),
    pulled: 2,
    pushed: 3,
    deleted: 0,
    skipped: [],
    conflicts: [],
  });
  service.unlockSyncVaultWithPasskey.mockReset();
  service.unlockSyncVaultWithPasskey.mockResolvedValue({ unlocked: true });
  toast.notifySuccess.mockReset();
  toast.notifyError.mockReset();
});

describe("SyncStatusButton", () => {
  it("renders nothing while the sync module is off", () => {
    modules.isSyncEnabled.mockReturnValue(false);
    const { view } = renderButton();
    expect(view.container).toBeEmptyDOMElement();
  });

  it("opens the Data tab instead of syncing while the vault is locked", () => {
    engine.useSyncEngine.mockReturnValue(status({ unlocked: false }));
    const { onOpenSettings } = renderButton();

    fireEvent.click(
      screen.getByRole("button", { name: /open sync settings/i }),
    );

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(service.syncNow).not.toHaveBeenCalled();
  });

  it("runs a sync pass and reports the counts", async () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));

    await waitFor(() => expect(service.syncNow).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toast.notifySuccess).toHaveBeenCalledWith(
        expect.stringContaining("2 pulled, 3 pushed"),
      ),
    );
  });

  it("shows the running state and ignores clicks while a pass is running", () => {
    engine.useSyncEngine.mockReturnValue(status({ running: true }));
    renderButton();

    const button = screen.getByRole("button", { name: /syncing/i });
    fireEvent.click(button);

    expect(service.syncNow).not.toHaveBeenCalled();
  });

  it("reports a failed pass", async () => {
    service.syncNow.mockRejectedValue(new Error("server unreachable"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));

    await waitFor(() =>
      expect(toast.notifyError).toHaveBeenCalledWith(
        expect.stringContaining("server unreachable"),
        expect.any(Number),
      ),
    );
  });

  it("offers the automatic-sync switch once sync is enabled and set up", () => {
    renderButton();

    expect(screen.getByRole("switch", { name: /automatic synchronization on/i }))
      .toBeChecked();
  });

  it("pauses and resumes the automatic passes without locking the vault", () => {
    const { store, onOpenSettings } = renderButton();

    const toggle = screen.getByRole("switch", {
      name: /automatic synchronization on/i,
    });
    fireEvent.click(toggle);

    expect(store.getState().user_settings.sync).toEqual({
      enabled: true,
      auto: false,
    });
    // The click must not open the profile modal through the card around it.
    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(service.syncNow).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("switch", { name: /automatic synchronization off/i }),
    );
    expect(store.getState().user_settings.sync).toEqual({
      enabled: true,
      auto: true,
    });
  });

  it("unlocks with the passkey and syncs when the vault is locked", async () => {
    engine.useSyncEngine.mockReturnValue(
      status({ unlocked: false, passkey: true, passkeySupported: true }),
    );
    // The scenario this exists for: automatic sync is paused, so nothing asked
    // at startup; the click is the moment the passkey is needed.
    const { onOpenSettings } = renderButton({ enabled: true, auto: false });

    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));

    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(service.syncNow).toHaveBeenCalledTimes(1));
    // A click is a user gesture, so this attempt is not the silent one.
    expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith();
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it("falls back to the Data tab when the passkey does not open the vault", async () => {
    service.unlockSyncVaultWithPasskey.mockRejectedValue(
      new Error("cancelled"),
    );
    engine.useSyncEngine.mockReturnValue(
      status({ unlocked: false, passkey: true, passkeySupported: true }),
    );
    const { onOpenSettings } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));

    await waitFor(() => expect(onOpenSettings).toHaveBeenCalledTimes(1));
    expect(service.syncNow).not.toHaveBeenCalled();
  });

  it("paints the switch green while automatic sync is on and red when it is paused", () => {
    renderButton();

    expect(
      screen.getByRole("switch", { name: /automatic synchronization on/i }),
    ).toHaveClass("toggle-success");

    fireEvent.click(
      screen.getByRole("switch", { name: /automatic synchronization on/i }),
    );

    expect(
      screen.getByRole("switch", { name: /automatic synchronization off/i }),
    ).toHaveClass("toggle-error");
  });

  it("paints the sync button green while automatic sync is on and the key is available", () => {
    renderButton();

    expect(
      screen.getByRole("button", { name: /sync now/i }),
    ).toHaveClass("text-success");
  });

  it("does not paint the button green when the passkey prompt was aborted", () => {
    // The vault is set up and automatic sync is on, but no key is in memory:
    // the authenticator was cancelled, so nothing will sync on its own.
    engine.useSyncEngine.mockReturnValue(
      status({ unlocked: false, passkey: true, passkeySupported: true }),
    );
    renderButton({ enabled: true, auto: true });

    const button = screen.getByRole("button", { name: /sync now/i });
    expect(button).toHaveClass("text-info");
    expect(button).not.toHaveClass("text-success");
  });

  it("paints the button gray while the vault was never created", () => {
    engine.useSyncEngine.mockReturnValue(
      status({ configured: false, unlocked: false }),
    );
    renderButton({ enabled: true, auto: true });

    expect(
      screen.getByRole("button", { name: /open sync settings/i }),
    ).toHaveClass("text-base-content/50");
  });

  it("paints the sync button blue when automatic sync is paused", () => {
    renderButton({ enabled: true, auto: false });

    expect(
      screen.getByRole("button", { name: /sync now/i }),
    ).toHaveClass("text-info");
  });

  it("paints the sync button gray while nothing is set up", () => {
    engine.useSyncEngine.mockReturnValue(status({ configured: false }));
    renderButton({ enabled: false, auto: false });

    expect(
      screen.getByRole("button", { name: /sync now/i }),
    ).toHaveClass("text-base-content/50");
  });

  it("places the switch underneath the sync button", () => {
    renderButton();

    const button = screen.getByRole("button", { name: /sync now/i });
    const toggle = screen.getByRole("switch", {
      name: /automatic synchronization/i,
    });

    expect(button.parentElement).toHaveClass("flex-col");
    expect(button.nextElementSibling).toBe(toggle);
  });

  it("hides the switch while the synchronization is switched off", () => {
    engine.useSyncEngine.mockReturnValue(status({ enabled: false }));
    renderButton({ enabled: false, auto: true });

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    // The manual button stays, so a locked vault can still lead to the form.
    expect(
      screen.getByRole("button", { name: /sync now/i }),
    ).toBeInTheDocument();
  });

  it("hides the switch while no vault exists yet", () => {
    engine.useSyncEngine.mockReturnValue(status({ configured: false }));
    renderButton();

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
