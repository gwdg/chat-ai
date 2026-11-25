import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import en from "../../../i18n/en";
import ErrorScreen from "../ErrorScreen";
import { downloadLocalData } from "../../../utils/dataExport";

vi.mock("../../../utils/dataExport", () => ({
  downloadLocalData: vi.fn(() => Promise.resolve("user-chat-ai.json")),
}));

const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.init({
    lng: "en",
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
});

const renderScreen = (props) =>
  render(
    <I18nextProvider i18n={i18n}>
      <ErrorScreen {...props} />
    </I18nextProvider>,
  );

describe("ErrorScreen", () => {
  it("shows the message and details and invokes the reload handler", () => {
    const onReload = vi.fn();
    renderScreen({
      title: "Local database unavailable",
      message: "Close the other tabs.",
      details: "VersionError: newer schema",
      reloadLabel: "Reload",
      onReload,
    });

    expect(screen.getByText("Local database unavailable")).toBeInTheDocument();
    expect(screen.getByText("Close the other tabs.")).toBeInTheDocument();
    expect(screen.getByText("VersionError: newer schema")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("hides the details section when there are no details", () => {
    renderScreen({
      title: "Something went wrong",
      message: "Try again.",
      reloadLabel: "Reload",
      onReload: vi.fn(),
    });

    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("always says the data is safe, offers a save button and names support", () => {
    renderScreen({
      title: "Something went wrong",
      message: "Try again.",
      reloadLabel: "Reload",
      onReload: vi.fn(),
    });

    expect(screen.getByText("Your data is safe")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save all my data/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "support@gwdg.de" }),
    ).toHaveAttribute("href", "mailto:support@gwdg.de");
  });

  it("downloads every saved byte from the error screen itself", async () => {
    renderScreen({
      title: "Something went wrong",
      message: "Try again.",
      reloadLabel: "Reload",
      onReload: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: /Save all my data/i }));

    await waitFor(() => expect(downloadLocalData).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Your file has been downloaded."),
    ).toBeInTheDocument();
  });

  it("offers retry as the primary action when the caller can retry", () => {
    const onRetry = vi.fn();
    const onReload = vi.fn();
    renderScreen({
      title: "Local database unavailable",
      message: "Close the other tabs.",
      reloadLabel: "Reload",
      retryLabel: "Retry",
      onRetry,
      onReload,
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
