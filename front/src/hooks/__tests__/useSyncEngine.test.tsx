import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import userSettingsReducer, {
  setSyncAuto,
  setSyncEnabled,
} from "../../Redux/reducers/userSettingsReducer";
import { useSyncEngine } from "../useSyncEngine";

const modules = vi.hoisted(() => ({ isSyncEnabled: vi.fn(() => true) }));

const service = vi.hoisted(() => {
  const state = {
    enabled: true,
    configured: true,
    unlocked: false,
    passkey: true,
    passkeyLabel: "Laptop",
    passkeySupported: true,
    running: false,
    deviceId: null,
    vaultId: "vault-1",
    fingerprint: null,
    lastRunAt: null,
    lastSummary: null,
    conflicts: 0,
    skipped: 0,
    error: null,
    progress: null,
  };
  return {
    state,
    getSyncStatus: vi.fn(() => ({ ...state })),
    loadSyncStatus: vi.fn(async () => ({ ...state })),
    runSyncIfDue: vi.fn(),
    setSyncPreferences: vi.fn(),
    startAutoSync: vi.fn(),
    stopAutoSync: vi.fn(),
    subscribeSyncStatus: vi.fn(() => () => {}),
    unlockSyncVaultWithPasskey: vi.fn(async () => ({
      ...state,
      unlocked: true,
    })),
  };
});

vi.mock("../../utils/modules", () => ({
  isSyncEnabled: modules.isSyncEnabled,
}));
vi.mock("../../sync/service", () => ({
  getSyncStatus: service.getSyncStatus,
  loadSyncStatus: service.loadSyncStatus,
  runSyncIfDue: service.runSyncIfDue,
  setSyncPreferences: service.setSyncPreferences,
  startAutoSync: service.startAutoSync,
  stopAutoSync: service.stopAutoSync,
  subscribeSyncStatus: service.subscribeSyncStatus,
  unlockSyncVaultWithPasskey: service.unlockSyncVaultWithPasskey,
}));

const initialUserSettings = () =>
  userSettingsReducer(undefined, { type: "@@INIT" });

const renderEngine = (enabled = true, auto = true) => {
  const store = configureStore({
    reducer: { user_settings: userSettingsReducer },
    preloadedState: {
      user_settings: {
        ...initialUserSettings(),
        sync: { enabled, auto },
      },
    },
  });
  const view = renderHook(() => useSyncEngine(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
  return { store, view };
};

beforeEach(() => {
  Object.assign(service.state, {
    configured: true,
    unlocked: false,
    passkey: true,
    vaultId: "vault-1",
  });
  modules.isSyncEnabled.mockReturnValue(true);
  service.getSyncStatus.mockClear();
  service.loadSyncStatus.mockClear();
  service.runSyncIfDue.mockClear();
  service.unlockSyncVaultWithPasskey.mockClear();
  service.startAutoSync.mockClear();
  service.stopAutoSync.mockClear();
});

afterEach(() => {
  delete (document as any).visibilityState;
});

/** jsdom reports `visible`; a test sets the property to simulate a hidden tab. */
const setVisibility = (value: string) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
};

describe("useSyncEngine passkey unlock", () => {
  it("unlocks with the passkey at app start, with no passphrase and no hint", async () => {
    const { view } = renderEngine();

    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith({
        silent: true,
      }),
    );
    view.unmount();
  });

  it("asks once, not on every render", async () => {
    const { store, view } = renderEngine();
    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledTimes(1),
    );

    act(() => {
      store.dispatch(setSyncEnabled(true));
    });

    expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("waits for a background tab to come to the front", async () => {
    setVisibility("hidden");
    const { view } = renderEngine();

    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    // A hidden tab must not pop an authenticator dialog the user cannot see.
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();

    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith({
        silent: true,
      }),
    );
    view.unmount();
  });

  it("does not ask while the synchronization is switched off", async () => {
    const { view } = renderEngine(false);

    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();
    view.unmount();
  });

  it("does not ask after a reload while the automatic sync is paused", async () => {
    const { view } = renderEngine(true, false);

    // Nothing will sync on its own, so the passkey is not needed until the user
    // presses "Sync now" or switches the automatic passes back on.
    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();
    view.unmount();
  });

  it("asks when the automatic sync is switched back on", async () => {
    const { store, view } = renderEngine(true, false);
    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(setSyncAuto(true));
    });

    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith({
        silent: true,
      }),
    );
    view.unmount();
  });

  it("does not ask when this device has no passkey", async () => {
    service.state.passkey = false;
    const { view } = renderEngine();

    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();
    view.unmount();
  });

  it("does not ask when the vault is already unlocked", async () => {
    service.state.unlocked = true;
    const { view } = renderEngine();

    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();
    view.unmount();
  });

  it("runs a due pass in the visible tab once the vault is open", async () => {
    service.state.unlocked = true;
    const { view } = renderEngine();

    // The service decides whether the interval has elapsed; the hook only makes
    // sure the unlocked, visible tab is the one that asks.
    await waitFor(() => expect(service.runSyncIfDue).toHaveBeenCalled());
    view.unmount();
  });

  it("does not run a pass while the tab is hidden", async () => {
    setVisibility("hidden");
    service.state.unlocked = true;
    const { view } = renderEngine();

    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    expect(service.runSyncIfDue).not.toHaveBeenCalled();
    view.unmount();
  });

  it("catches up when the persisted preference arrives after mount", async () => {
    const { store, view } = renderEngine(false);
    await waitFor(() => expect(service.loadSyncStatus).toHaveBeenCalled());
    expect(service.unlockSyncVaultWithPasskey).not.toHaveBeenCalled();

    act(() => {
      store.dispatch(setSyncEnabled(true));
    });

    await waitFor(() =>
      expect(service.unlockSyncVaultWithPasskey).toHaveBeenCalledWith({
        silent: true,
      }),
    );
    view.unmount();
  });
});
