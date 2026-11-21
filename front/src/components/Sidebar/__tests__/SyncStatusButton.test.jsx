import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SyncStatusButton from "../SyncStatusButton";

const modules = vi.hoisted(() => ({ isSyncEnabled: vi.fn(() => true) }));
const engine = vi.hoisted(() => ({ useSyncEngine: vi.fn() }));
const service = vi.hoisted(() => ({ syncNow: vi.fn() }));
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

const renderButton = () => {
  const onOpenSettings = vi.fn();
  const view = render(<SyncStatusButton onOpenSettings={onOpenSettings} />);
  return { view, onOpenSettings };
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
});
