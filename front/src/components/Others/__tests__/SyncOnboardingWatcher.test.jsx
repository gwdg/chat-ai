import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";

import SyncOnboardingWatcher from "../SyncOnboardingWatcher";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";
import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";

const access = vi.hoisted(() => ({ value: "available" }));
const modules = vi.hoisted(() => ({ isSyncEnabled: vi.fn(() => true) }));
const service = vi.hoisted(() => ({ hasRemoteVault: vi.fn(async () => false) }));
const modal = vi.hoisted(() => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
}));

vi.mock("../../../utils/modules", () => ({
  isSyncEnabled: modules.isSyncEnabled,
}));
vi.mock("../../../hooks/useSaiaFsAccess", () => ({
  SAIA_FS_CHECKING: "checking",
  SAIA_FS_AVAILABLE: "available",
  SAIA_FS_UNAVAILABLE: "unavailable",
  useSaiaFsAccess: () => access.value,
}));
vi.mock("../../../hooks/useUpdateUserData", () => ({
  useUpdateUserData: () => ({ username: "sample-user" }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => modal,
}));
vi.mock("../../../sync/service", () => service);

const renderWatcher = (preloadedState) => {
  const store = configureStore({
    reducer: {
      interface_settings: interfaceSettingsReducer,
      user_settings: userSettingsReducer,
    },
    preloadedState,
  });
  const view = render(
    <Provider store={store}>
      <SyncOnboardingWatcher />
    </Provider>,
  );
  return { store, view };
};

const offer = async () => {
  await waitFor(() => expect(modal.openModal).toHaveBeenCalled());
  const [type, props] = modal.openModal.mock.calls[0];
  expect(type).toBe("syncOnboarding");
  return props;
};

beforeEach(() => {
  access.value = "available";
  modules.isSyncEnabled.mockReturnValue(true);
  service.hasRemoteVault.mockReset();
  service.hasRemoteVault.mockResolvedValue(false);
  modal.openModal.mockClear();
  modal.closeModal.mockClear();
});

describe("SyncOnboardingWatcher", () => {
  it("offers synchronization once when saia-fs is available and no copy exists", async () => {
    renderWatcher();

    const props = await offer();
    expect(props.existing).toBe(false);
    expect(typeof props.onAccept).toBe("function");
    expect(typeof props.onDismiss).toBe("function");
    expect(service.hasRemoteVault).toHaveBeenCalledTimes(1);
  });

  it("offers to set up the existing copy when another device created one", async () => {
    service.hasRemoteVault.mockResolvedValue(true);

    renderWatcher();

    const props = await offer();
    // The dialog must not suggest creating a second copy for the account.
    expect(props.existing).toBe(true);
  });

  it("waits for the remote check before choosing the wording", async () => {
    let resolveCheck;
    service.hasRemoteVault.mockReturnValue(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );

    renderWatcher();

    await waitFor(() => expect(service.hasRemoteVault).toHaveBeenCalledTimes(1));
    expect(modal.openModal).not.toHaveBeenCalled();

    await act(async () => resolveCheck(true));

    const props = await offer();
    expect(props.existing).toBe(true);
  });

  it("falls back to the create wording when the remote check fails", async () => {
    service.hasRemoteVault.mockRejectedValue(new Error("offline"));

    renderWatcher();

    const props = await offer();
    // An unreachable filesystem says nothing about a copy; the Data tab checks
    // again and offers the unlock form when it is reachable.
    expect(props.existing).toBe(false);
  });

  it("checks the remote vault only once while the offer is pending", async () => {
    const { store } = renderWatcher();
    await offer();

    // A re-render with the same conditions must not probe again.
    act(() => {
      store.dispatch({ type: "interface_settings/toggleSidebar" });
    });

    expect(service.hasRemoteVault).toHaveBeenCalledTimes(1);
    expect(
      modal.openModal.mock.calls.filter(([type]) => type === "syncOnboarding"),
    ).toHaveLength(1);
  });

  it("stays quiet while the health probe has not answered", async () => {
    access.value = "checking";
    renderWatcher();

    await waitFor(() =>
      expect(service.hasRemoteVault).not.toHaveBeenCalled(),
    );
    expect(modal.openModal).not.toHaveBeenCalled();
  });

  it("stays quiet when the deployment has no saia-fs", async () => {
    access.value = "unavailable";
    renderWatcher();

    await waitFor(() =>
      expect(service.hasRemoteVault).not.toHaveBeenCalled(),
    );
    expect(modal.openModal).not.toHaveBeenCalled();
  });

  it("does not offer again after a dismissal on this device", async () => {
    renderWatcher({
      interface_settings: {
        ...interfaceSettingsReducer(undefined, { type: "@@INIT" }),
        sync_onboarding_dismissed: true,
      },
    });

    // The dismissal covers both wordings: a copy that appears later does not
    // bring the dialog back on this device.
    await waitFor(() =>
      expect(service.hasRemoteVault).not.toHaveBeenCalled(),
    );
    expect(modal.openModal).not.toHaveBeenCalled();
  });

  it("does not offer when the user already enabled it", async () => {
    renderWatcher({
      user_settings: {
        ...userSettingsReducer(undefined, { type: "@@INIT" }),
        sync: { enabled: true, auto: true },
      },
    });

    await waitFor(() =>
      expect(service.hasRemoteVault).not.toHaveBeenCalled(),
    );
    expect(modal.openModal).not.toHaveBeenCalled();
  });

  it("does not offer when the sync module is off", async () => {
    modules.isSyncEnabled.mockReturnValue(false);
    renderWatcher();

    await waitFor(() =>
      expect(service.hasRemoteVault).not.toHaveBeenCalled(),
    );
    expect(modal.openModal).not.toHaveBeenCalled();
  });

  it("enables sync and opens the Data section on accept", async () => {
    const { store } = renderWatcher();
    const props = await offer();

    act(() => props.onAccept());

    expect(store.getState().user_settings.sync.enabled).toBe(true);
    expect(store.getState().interface_settings.sync_onboarding_dismissed).toBe(
      true,
    );
    expect(modal.openModal).toHaveBeenLastCalledWith("userSettings", {
      initialTab: "data/sync",
      userData: { username: "sample-user" },
    });
    // Accepting is the answer for this device: no second offer.
    expect(
      modal.openModal.mock.calls.filter(([type]) => type === "syncOnboarding"),
    ).toHaveLength(1);
  });

  it("records a dismissal without enabling sync", async () => {
    const { store } = renderWatcher();
    const props = await offer();

    act(() => props.onDismiss());

    expect(store.getState().user_settings.sync.enabled).toBe(false);
    expect(store.getState().interface_settings.sync_onboarding_dismissed).toBe(
      true,
    );
    expect(modal.closeModal).toHaveBeenCalled();
    expect(
      modal.openModal.mock.calls.filter(([type]) => type === "syncOnboarding"),
    ).toHaveLength(1);
  });
});
