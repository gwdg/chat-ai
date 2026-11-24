import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import DataSettings from "../DataSettings";

const modules = vi.hoisted(() => ({ isSyncEnabled: vi.fn(() => true) }));
const conversationUtils = vi.hoisted(() => ({ getExportData: vi.fn() }));
const toast = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../utils/modules", () => ({
  isSyncEnabled: modules.isSyncEnabled,
}));
vi.mock("../../../utils/conversationUtils", () => ({
  getExportData: conversationUtils.getExportData,
}));
vi.mock("../../../hooks/useToast", () => ({ useToast: () => toast }));
vi.mock("../../ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

// The three panels are separate components with their own suites; this test is
// about which one the Data tab shows.
vi.mock("../StorageStatus", () => ({
  default: () => <div data-testid="storage-status" />,
}));
vi.mock("../BackupSettings", () => ({
  default: () => <div data-testid="backup-settings" />,
}));
vi.mock("../SyncSettings", () => ({
  default: () => <div data-testid="sync-settings" />,
}));
vi.mock("../../../components/Sidebar/Buttons/ImportChatButton", () => ({
  default: () => <button type="button">Import</button>,
}));

const makeStore = () =>
  configureStore({ reducer: { user_settings: userSettingsReducer } });

const renderData = (props = {}) =>
  render(
    <Provider store={makeStore()}>
      <DataSettings userData={{ username: "jane.doe" }} {...props} />
    </Provider>,
  );

const subtab = (name) => screen.getByRole("tab", { name });

beforeEach(() => {
  modules.isSyncEnabled.mockReturnValue(true);
  conversationUtils.getExportData.mockReset();
  conversationUtils.getExportData.mockResolvedValue({ conversations: [] });
  toast.notifySuccess.mockReset();
  toast.notifyError.mockReset();
});

describe("DataSettings", () => {
  it("starts on Manage data and keeps the backup and server synchronization out of sight", () => {
    renderData();

    expect(subtab(/manage data/i)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("storage-status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.queryByTestId("backup-settings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sync-settings")).not.toBeInTheDocument();
  });

  it("switches to one section at a time", () => {
    renderData();

    fireEvent.click(subtab(/encrypted backup/i));
    expect(subtab(/encrypted backup/i)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("backup-settings")).toBeInTheDocument();
    expect(screen.queryByTestId("storage-status")).not.toBeInTheDocument();

    fireEvent.click(subtab(/server synchronization/i));
    expect(screen.getByTestId("sync-settings")).toBeInTheDocument();
    expect(screen.queryByTestId("backup-settings")).not.toBeInTheDocument();
  });

  it("opens on a requested section, so a deep link lands on it", () => {
    renderData({ initialSection: "backup" });

    expect(screen.getByTestId("backup-settings")).toBeInTheDocument();
    expect(subtab(/encrypted backup/i)).toHaveAttribute("aria-selected", "true");
  });

  it("offers no server synchronization tab while the sync module is off", () => {
    modules.isSyncEnabled.mockReturnValue(false);
    renderData();

    expect(screen.queryByRole("tab", { name: /server synchronization/i })).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("falls back to Manage data when the requested section is unavailable", () => {
    modules.isSyncEnabled.mockReturnValue(false);
    renderData({ initialSection: "sync" });

    expect(subtab(/manage data/i)).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByTestId("sync-settings")).not.toBeInTheDocument();
  });

  it("exports the local data from the manage section", async () => {
    renderData();

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() =>
      expect(conversationUtils.getExportData).toHaveBeenCalledTimes(1),
    );
    expect(toast.notifySuccess).toHaveBeenCalledTimes(1);
  });
});
