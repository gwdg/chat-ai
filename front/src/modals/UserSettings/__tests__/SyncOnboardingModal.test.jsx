import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SyncOnboardingModal from "../SyncOnboardingModal";

const passkeys = vi.hoisted(() => ({ supported: true }));

vi.mock("../../../sync/passkey", () => ({
  isPasskeySupported: () => passkeys.supported,
}));

beforeEach(() => {
  passkeys.supported = true;
});

describe("SyncOnboardingModal", () => {
  it("describes the feature, its encryption and the optional passkey", () => {
    render(
      <SyncOnboardingModal isOpen onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(
      screen.getByText(/keep your chats in step across devices/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/saia filesystem/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/encrypted before upload/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/optional passkey/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is uploaded/i)).toBeInTheDocument();
    expect(
      screen.getByText(/never stored/i),
    ).toBeInTheDocument();
  });

  it("routes to the setup on accept", () => {
    const onAccept = vi.fn();
    render(
      <SyncOnboardingModal isOpen onAccept={onAccept} onDismiss={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /set up synchronization/i }),
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("omits the passkey when this browser cannot use one", () => {
    passkeys.supported = false;
    render(
      <SyncOnboardingModal isOpen onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(screen.queryByText(/optional passkey/i)).not.toBeInTheDocument();
    // The rest of the offer still stands.
    expect(screen.getByText(/encrypted before upload/i)).toBeInTheDocument();
  });

  it("describes the copy another device created when it exists", () => {
    render(
      <SyncOnboardingModal
        isOpen
        existing
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/already exists for this account/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/another device already stores an encrypted copy/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/passphrase that copy was created with/i),
    ).toBeInTheDocument();
    // The create wording would be wrong here: the copy must not be duplicated.
    expect(
      screen.queryByText(/nothing is uploaded until you create the copy/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/keep your chats in step across devices/i),
    ).not.toBeInTheDocument();
  });

  it("routes to setup from the existing-copy offer", () => {
    const onAccept = vi.fn();
    render(
      <SyncOnboardingModal
        isOpen
        existing
        onAccept={onAccept}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /set it up on this device/i }),
    );
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("keeps the create wording without the existing flag", () => {
    render(
      <SyncOnboardingModal isOpen onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(
      screen.queryByText(/already exists for this account/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /set up synchronization/i }),
    ).toBeInTheDocument();
  });

  it("declines without applying anything", () => {
    const onDismiss = vi.fn();
    render(
      <SyncOnboardingModal isOpen onAccept={vi.fn()} onDismiss={onDismiss} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
