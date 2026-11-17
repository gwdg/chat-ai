import { render, screen } from "@testing-library/react";
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

const localState = {
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
      localState={localState}
      setLocalState={vi.fn()}
      modelsData={{}}
      userData={{}}
      {...props}
    />,
  );

describe("Conversation close actions row", () => {
  it("keeps the actions row in normal flow above the warning", () => {
    const { container } = renderConversation();
    const button = screen.getByRole("button", { name: "Close chat" });
    const row = button.parentElement.parentElement.parentElement;

    expect(row.className).toContain("justify-end");
    expect(row.className).not.toMatch(/(^|\s)(absolute|fixed)(\s|$)/);

    const warning = screen.getByTestId("hallucination-warning");
    expect(
      row.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    let node = button;
    while (node && node !== container) {
      expect(node.className || "").not.toContain("pointer-events-none");
      node = node.parentElement;
    }
  });

  it("renders no close control when hideCloseButton is set", () => {
    renderConversation({ hideCloseButton: true });
    expect(
      screen.queryByRole("button", { name: "Close chat" }),
    ).not.toBeInTheDocument();
  });
});
