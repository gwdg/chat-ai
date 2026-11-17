import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmAction: vi.fn(),
  navigate: vi.fn(),
  deleteConversation: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({ user_settings: {} }),
}));
vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ confirmAction: mocks.confirmAction }),
}));
vi.mock("../../../db", () => ({
  deleteConversation: (...args) => mocks.deleteConversation(...args),
}));

import CloseChatButton from "../CloseChatButton";

const renderButton = (localState) => {
  const setLocalState = vi.fn();
  const view = render(
    <CloseChatButton localState={localState} setLocalState={setLocalState} />,
  );
  return { ...view, setLocalState };
};

beforeEach(() => {
  mocks.confirmAction.mockReset();
  mocks.navigate.mockReset();
  mocks.deleteConversation.mockReset();
  mocks.deleteConversation.mockResolvedValue(undefined);
});

describe("CloseChatButton", () => {
  it("renders one circular close control with no overlay class of its own", () => {
    const { container } = renderButton({ id: "chat-1" });
    const button = screen.getByRole("button", { name: "Close chat" });

    expect(button).toHaveAttribute("data-guide", "close-chat");
    expect(button).toHaveClass("btn", "btn-circle", "shadow-lg");
    expect(button.className).not.toMatch(/(^|\s)(absolute|fixed|z-\d+)(\s|$)/);
    expect(button.querySelector("svg")).toBeInTheDocument();

    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(container.firstElementChild.tagName).toBe("SPAN");
    expect(container.firstElementChild).toBe(button.parentElement);
  });

  it("renders nothing without a conversation id", () => {
    const { container } = renderButton({});
    expect(container).toBeEmptyDOMElement();
  });

  it("asks to delete a normal chat", async () => {
    const { setLocalState } = renderButton({ id: "chat-1" });

    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));

    expect(mocks.confirmAction).toHaveBeenCalledTimes(1);
    const [options, onConfirm] = mocks.confirmAction.mock.calls[0];
    expect(options).toMatchObject({
      warningKey: "warn_close_chat",
      messageKey: "alert.close_chat",
      confirmKey: "alert.close_chat_yes",
      danger: true,
    });

    await act(async () => {
      await onConfirm();
    });

    expect(mocks.deleteConversation).toHaveBeenCalledWith("chat-1");
    expect(mocks.navigate).toHaveBeenCalledWith("/chat/");
    expect(setLocalState).not.toHaveBeenCalled();
  });

  it("asks to clear the meta chat and resets its local state", () => {
    const { setLocalState } = renderButton({
      id: "meta-chat",
      isMetaChat: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }));

    expect(mocks.confirmAction).toHaveBeenCalledTimes(1);
    const [options, onConfirm] = mocks.confirmAction.mock.calls[0];
    expect(options).toMatchObject({
      warningKey: "warn_clear_history",
      messageKey: "alert.clear_messages",
      confirmKey: "alert.yes",
      danger: true,
    });

    onConfirm();

    expect(setLocalState).toHaveBeenCalledTimes(1);
    const update = setLocalState.mock.calls[0][0];
    const next = update({
      id: "meta-chat",
      messages: [{ role: "system" }],
      hasFirstPrompt: true,
    });
    expect(next.id).toBe("meta-chat");
    expect(next.hasFirstPrompt).toBe(false);
    expect(Array.isArray(next.messages)).toBe(true);
    expect(mocks.deleteConversation).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
