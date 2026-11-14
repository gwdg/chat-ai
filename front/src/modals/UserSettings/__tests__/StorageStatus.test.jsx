import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import StorageStatus from "../StorageStatus";
import {
  getStorageStatus,
  requestPersistentStorage,
} from "../../../utils/storagePersistence";

vi.mock("../../../utils/storagePersistence", () => ({
  getStorageStatus: vi.fn(),
  requestPersistentStorage: vi.fn(),
}));

describe("StorageStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows persistent storage and the usage estimate", async () => {
    vi.mocked(getStorageStatus).mockResolvedValue({
      supported: true,
      persisted: true,
      usage: 1024,
      quota: 2048,
    });

    render(<StorageStatus />);

    expect(
      await screen.findByText(i18n.t("user_settings.data.storage_persisted")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        i18n.t("user_settings.data.storage_usage", {
          used: "1.0 KB",
          quota: "2.0 KB",
        }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: i18n.t("user_settings.data.storage_request"),
      }),
    ).not.toBeInTheDocument();
  });

  it("requests persistent storage and refreshes the status", async () => {
    vi.mocked(getStorageStatus)
      .mockResolvedValueOnce({ supported: true, persisted: false })
      .mockResolvedValueOnce({ supported: true, persisted: true });
    vi.mocked(requestPersistentStorage).mockResolvedValue(true);

    render(<StorageStatus />);

    const button = await screen.findByRole("button", {
      name: i18n.t("user_settings.data.storage_request"),
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(requestPersistentStorage).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText(i18n.t("user_settings.data.storage_persisted")),
    ).toBeInTheDocument();
    expect(getStorageStatus).toHaveBeenCalledTimes(2);
  });

  it("explains when this browser exposes no storage information", async () => {
    vi.mocked(getStorageStatus).mockResolvedValue({
      supported: false,
      persisted: false,
    });

    render(<StorageStatus />);

    expect(
      await screen.findByText(i18n.t("user_settings.data.storage_unavailable")),
    ).toBeInTheDocument();
  });
});
