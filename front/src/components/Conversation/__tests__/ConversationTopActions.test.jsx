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
  it("floats the close button over the top of the chat without a cover above it", () => {
    const { container } = renderConversation();

    const closeButtons = screen.getAllByRole("button", { name: "Close chat" });
    expect(closeButtons).toHaveLength(1);
    const closeButton = closeButtons[0];
    expect(closeButton).toHaveAttribute("data-guide", "close-chat");
    expect(closeButton).toHaveClass("btn", "btn-circle", "shadow-lg");
    expect(closeButton.className).not.toMatch(/(^|\s)(absolute|fixed)(\s|$)/);

    const closeRow = closeButton.parentElement.parentElement;
    expect(closeRow).toHaveClass("absolute", "right-2", "top-2", "z-20");

    const messageList = container.querySelector(".overflow-y-auto");
    expect(messageList).not.toBeNull();
    expect(messageList).not.toContainElement(closeRow);

    // The notice is the first item of the conversation, not a band over it.
    const warning = screen.getByTestId("hallucination-warning");
    const column = messageList.firstElementChild;
    expect(column.firstElementChild).toBe(warning);
    expect(closeRow).not.toContainElement(warning);

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
