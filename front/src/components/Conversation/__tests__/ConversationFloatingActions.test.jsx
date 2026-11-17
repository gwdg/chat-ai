import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-redux", () => ({
  useSelector: () => false,
}));
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ confirmAction: vi.fn() }),
}));
vi.mock("../../../db", () => ({
  deleteConversation: vi.fn(),
}));
vi.mock("../../Prompt/Prompt", () => ({
  default: () => <div data-testid="prompt" />,
}));
vi.mock("../HallucinationWarning", () => ({
  default: () => <div data-testid="hallucination-warning" />,
}));
vi.mock("../MessageUser/MessageUser", () => ({
  default: () => <div data-testid="message-user" />,
}));
vi.mock("../MessageAssistant/MessageAssistant", () => ({
  default: () => <div data-testid="message-assistant" />,
}));

import Conversation from "../Conversation";

const CLUSTER_CLASSES = [
  "absolute",
  "bottom-3",
  "right-5",
  "md:right-3",
  "z-10",
  "flex",
  "flex-col",
  "items-center",
  "gap-2",
];

const localState = {
  id: "chat-1",
  messages: [
    { id: "system", role: "system", content: [] },
    { id: "user", role: "user", content: [] },
    { id: "assistant", role: "assistant", content: [] },
    { id: "user-2", role: "user", content: [] },
  ],
};

const renderConversation = (props = {}) =>
  render(
    <Conversation
      localState={localState}
      setLocalState={vi.fn()}
      modelsData={{}}
      userData={{}}
      {...props}
    />,
  );

describe("Conversation floating actions", () => {
  it("stacks the close button above the undo button in the bottom-right cluster", () => {
    renderConversation();

    const closeButton = screen.getByRole("button", { name: "Close chat" });
    expect(closeButton).toHaveClass("btn", "btn-circle", "shadow-lg");
    expect(closeButton.className).not.toMatch(/(^|\s)(absolute|fixed)(\s|$)/);

    const cluster = closeButton.parentElement.parentElement;
    for (const className of CLUSTER_CLASSES) {
      expect(cluster).toHaveClass(className);
    }

    const [first, second] = within(cluster).getAllByRole("button");
    expect(first).toBe(closeButton);
    expect(second).toHaveClass("btn", "btn-circle", "shadow-lg");
    expect(second.querySelector("svg")).toBeInTheDocument();

    const warning = screen.getByTestId("hallucination-warning");
    expect(
      warning.compareDocumentPosition(cluster) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the close button alone when the conversation is too short to undo", () => {
    renderConversation({
      localState: {
        id: "chat-1",
        messages: [
          { id: "system", role: "system", content: [] },
          { id: "user", role: "user", content: [] },
          { id: "assistant", role: "assistant", content: [] },
        ],
      },
    });

    const closeButton = screen.getByRole("button", { name: "Close chat" });
    const cluster = closeButton.parentElement.parentElement;
    expect(within(cluster).getAllByRole("button")).toHaveLength(1);
  });

  it("renders no close control when hideCloseButton is set", () => {
    renderConversation({ hideCloseButton: true });
    expect(
      screen.queryByRole("button", { name: "Close chat" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
