import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import i18n from "../../../i18n";
import { canInstallApp } from "../../../utils/installPrompt";
import InstallAppButton from "../InstallAppButton";

const installEvent = ({ outcome = "accepted" } = {}) => {
  const event = new Event("beforeinstallprompt");
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  return event;
};

const clearInstallState = () => {
  act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
};

describe("InstallAppButton", () => {
  afterEach(async () => {
    clearInstallState();
    await i18n.changeLanguage("en");
  });

  it("renders nothing until the browser offers an install prompt", () => {
    render(<InstallAppButton />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(canInstallApp()).toBe(false);
  });

  it("offers the install dialog and drops the prompt after one use", async () => {
    render(<InstallAppButton />);
    const event = installEvent();

    act(() => {
      window.dispatchEvent(event);
    });

    const button = screen.getByRole("button", { name: "Install this app" });
    expect(canInstallApp()).toBe(true);

    await act(async () => {
      fireEvent.click(button);
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    // The browser's event can only be used once, so the button goes away.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(canInstallApp()).toBe(false);
  });

  it("hides the button when the app was installed from the browser menu", async () => {
    render(<InstallAppButton />);
    act(() => {
      window.dispatchEvent(installEvent());
    });
    expect(
      screen.getByRole("button", { name: "Install this app" }),
    ).toBeInTheDocument();

    clearInstallState();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
