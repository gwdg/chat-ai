import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfileSettings from "../ProfileSettings";
import {
  setFeedbackEnabled,
  setFeedbackSendTranscripts,
} from "../../../Redux/reducers/userSettingsReducer";

const api = vi.hoisted(() => ({
  brand: { value: null },
  feedback: { enabled: false },
  dispatch: vi.fn(),
}));

vi.mock("../../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: api.brand.value }),
}));

// The feedback switch reads its preference from Redux; the section around it
// is what this test is about, so the store is a stub.
vi.mock("react-redux", () => ({
  useDispatch: () => api.dispatch,
  useSelector: () => true,
}));

// The Feedback section appears only while a receiver is configured.
vi.mock("../../../apis/feedback", () => ({
  isChatFeedbackEnabled: () => api.feedback.enabled,
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
  api.feedback.enabled = false;
  api.dispatch.mockClear();
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

  it("keeps the collected feedback on its own section", () => {
    api.feedback.enabled = true;

    render(<ProfileSettings userData={userData} />);

    // The account screen no longer carries the feedback card.
    expect(
      screen.queryByText("Feedback sent from this account"),
    ).not.toBeInTheDocument();

    const feedbackTab = screen.getByRole("tab", { name: "Feedback" });
    fireEvent.click(feedbackTab);

    expect(feedbackTab).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText("Feedback sent from this account"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View collected feedback" }),
    ).toBeInTheDocument();
  });

  it("offers the feedback switch there and can turn it off", () => {
    api.feedback.enabled = true;

    render(<ProfileSettings userData={userData} />);

    // The switch moved out of Chat preferences into this section.
    expect(
      screen.queryByRole("switch", { name: /Send feedback to the operator/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Feedback" }));

    const preference = screen.getByRole("switch", {
      name: /Send feedback to the operator/,
    });
    // The store stub resolves the preference to on.
    expect(preference).toHaveAttribute("aria-checked", "true");

    fireEvent.click(preference);

    expect(api.dispatch).toHaveBeenCalledWith(setFeedbackEnabled(false));
  });

  it("offers the chat-transcript switch beside the feedback one", () => {
    api.feedback.enabled = true;

    render(<ProfileSettings userData={userData} />);
    fireEvent.click(screen.getByRole("tab", { name: "Feedback" }));

    const transcript = screen.getByRole("switch", {
      name: /Send chat transcripts/,
    });
    expect(transcript).toHaveAttribute("aria-checked", "true");

    fireEvent.click(transcript);

    expect(api.dispatch).toHaveBeenCalledWith(setFeedbackSendTranscripts(false));
  });

  it("hides the feedback section without a configured receiver", () => {    render(<ProfileSettings userData={userData} />);

    expect(
      screen.queryByRole("tab", { name: "Feedback" }),
    ).not.toBeInTheDocument();
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
