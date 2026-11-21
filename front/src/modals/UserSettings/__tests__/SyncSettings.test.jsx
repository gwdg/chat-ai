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
  hasRemoteVault: vi.fn(),
  lockSyncVault: vi.fn(),
  rotateSyncVault: vi.fn(),
  runSyncIfUnlocked: vi.fn(),
  syncNow: vi.fn(),
}));

vi.mock("../../../utils/modules", () => ({
  isSyncEnabled: modules.isSyncEnabled,
}));
vi.mock("../../../sync/service", () => service);
vi.mock("../../../hooks/useSyncEngine", () => ({
  useSyncEngine: () => ({
    enabled: true,
    configured: false,
    unlocked: false,
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
  }),
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
  service.hasRemoteVault.mockReset();
  service.hasRemoteVault.mockResolvedValue(false);
  service.createSyncVault.mockReset();
  service.createSyncVault.mockResolvedValue({});
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
});
