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

const FLOATING_CLUSTER_CLASSES = [
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

const longLocalState = {
  id: "chat-1",
  messages: [
    { id: "system", role: "system", content: [] },
    { id: "user", role: "user", content: [] },
    { id: "assistant", role: "assistant", content: [] },
    { id: "user-2", role: "user", content: [] },
  ],
};

const shortLocalState = {
  id: "chat-1",
  messages: [
    { id: "system", role: "system", content: [] },
    { id: "user", role: "user", content: [] },
    { id: "assistant", role: "assistant", content: [] },
  ],
};

const renderConversation = (props = {}) =>
  render(
    <Conversation
      localState={longLocalState}
      setLocalState={vi.fn()}
      modelsData={{}}
      userData={{}}
      {...props}
    />,
  );

const getFloatingCluster = () => {
  const cluster = document.querySelector(".absolute.bottom-3.right-5");
  expect(cluster).not.toBeNull();
  return cluster;
};

describe("Conversation top and floating actions", () => {
  it("renders one close button in normal flow, below the warning and above the messages", () => {
    const { container } = renderConversation();

    const closeButtons = screen.getAllByRole("button", { name: "Close chat" });
    expect(closeButtons).toHaveLength(1);
    const closeButton = closeButtons[0];
    expect(closeButton).toHaveAttribute("data-guide", "close-chat");
    expect(closeButton).toHaveClass("btn", "btn-circle", "shadow-lg");
    expect(closeButton.className).not.toMatch(/(^|\s)(absolute|fixed)(\s|$)/);

    const closeRow = closeButton.parentElement.parentElement;
    expect(closeRow).toHaveClass("flex", "justify-end", "px-2", "pt-1");
    expect(closeRow.className).not.toMatch(/(^|\s)(absolute|fixed)(\s|$)/);

    const warning = screen.getByTestId("hallucination-warning");
    expect(
      warning.compareDocumentPosition(closeRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const messageList = container.querySelector(".overflow-y-auto");
    expect(messageList).not.toBeNull();
    expect(
      closeRow.compareDocumentPosition(messageList) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const cluster = getFloatingCluster();
    expect(closeRow).not.toBe(cluster);
    expect(cluster).not.toContainElement(closeButton);
    expect(
      within(cluster).queryByRole("button", { name: "Close chat" }),
    ).not.toBeInTheDocument();
  });

  it("keeps undo floating in the bottom-right cluster", () => {
    renderConversation();

    const closeButton = screen.getByRole("button", { name: "Close chat" });
    const cluster = getFloatingCluster();
    for (const className of FLOATING_CLUSTER_CLASSES) {
      expect(cluster).toHaveClass(className);
    }

    const buttons = within(cluster).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    const undoButton = buttons[0];
    expect(undoButton).not.toBe(closeButton);
    expect(undoButton).toHaveClass("btn", "btn-circle", "shadow-lg");
    expect(undoButton.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps the floating cluster empty when the conversation is too short to undo", () => {
    renderConversation({ localState: shortLocalState });

    expect(
      screen.getByRole("button", { name: "Close chat" }),
    ).toBeInTheDocument();
    expect(within(getFloatingCluster()).queryAllByRole("button")).toHaveLength(
      0,
    );
  });

  it("renders no close control when hideCloseButton is set", () => {
    renderConversation({ hideCloseButton: true });

    expect(
      screen.queryByRole("button", { name: "Close chat" }),
    ).not.toBeInTheDocument();
    expect(within(getFloatingCluster()).getAllByRole("button")).toHaveLength(1);
  });
});
