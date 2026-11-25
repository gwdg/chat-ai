import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfileSettings from "../ProfileSettings";

const api = vi.hoisted(() => ({ brand: { value: null } }));

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: api.brand.value }),
}));

// ProfileSettings opens the feedback history through the modal context; the
// provider itself is not part of this component's contract.
vi.mock("../../ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

// The consent switches read Redux; this test only checks that the screen is
// reachable as a Profile section, so a stub keeps it store-free.
vi.mock("../BrandConsentSettings", () => ({
  default: () => <div data-guide="brand-consent-settings">Consent switches</div>,
}));

const userData = {
  username: "alice",
  firstname: "Alice",
  lastname: "Example",
  email: "alice@example.org",
  organization: "Example Institute",
};

beforeEach(() => {
  api.brand.value = { id: "chat-ai", name: "Chat AI" };
});

describe("ProfileSettings", () => {
  it("shows only the user screen for a brand without an institute", () => {
    render(<ProfileSettings userData={userData} />);

    expect(screen.getByRole("tab", { name: "User" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByRole("tab", { name: "Institution" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("keeps the institute description a tab of its own", () => {
    api.brand.value = {
      id: "ugoe",
      name: "UGOE",
      institute: { name: "Georg-August-Universität Göttingen" },
    };

    render(<ProfileSettings userData={userData} />);

    // An institute without any restriction still gets the screen.
    expect(screen.getByRole("tab", { name: "Institution" })).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("switches between the user and the institution screen", () => {
    api.brand.value = {
      id: "restricted",
      name: "Restricted Chat AI",
      institute: { name: "Example Institute" },
      restrictions: { models: { fixed: "qwen3" } },
    };

    render(
      <ProfileSettings
        userData={userData}
        modelsData={[{ id: "qwen3", name: "Qwen 3" }]}
      />,
    );

    const institutionTab = screen.getByRole("tab", { name: "Institution" });
    fireEvent.click(institutionTab);

    expect(institutionTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: "Institution" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fixed to Qwen 3")).toBeInTheDocument();
    // The account data lives on the User screen only.
    expect(screen.queryByText("alice")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "User" }));
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("opens the institution screen from a deep link, without user data", () => {
    api.brand.value = {
      id: "ugoe",
      name: "UGOE",
      institute: { name: "Georg-August-Universität Göttingen" },
    };

    render(<ProfileSettings initialSection="institution" />);

    expect(screen.getByRole("tab", { name: "Institution" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText("Georg-August-Universität Göttingen"),
    ).toBeInTheDocument();
  });

  it("offers the consents as a Profile section for a brand with a consent gate", () => {
    api.brand.value = {
      id: "gaia",
      name: "GAIA",
      consentGate: {
        version: "1",
        purposes: [{ id: "study", label: { en: "Study" } }],
      },
    };

    render(<ProfileSettings userData={userData} />);

    const consentsTab = screen.getByRole("tab", { name: "Consents" });
    fireEvent.click(consentsTab);

    expect(consentsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Consent switches")).toBeInTheDocument();
  });

  it("hides the consents section for a brand without a consent gate", () => {
    render(<ProfileSettings userData={userData} />);

    expect(
      screen.queryByRole("tab", { name: "Consents" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the user screen for a section of another tab", () => {
    api.brand.value = {
      id: "restricted",
      institute: { name: "Example Institute" },
    };

    render(<ProfileSettings userData={userData} initialSection="backup" />);

    expect(screen.getByRole("tab", { name: "User" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("alice")).toBeInTheDocument();
  });
});
