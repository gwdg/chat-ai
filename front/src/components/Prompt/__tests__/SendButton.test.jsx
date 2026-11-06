import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SendButton from "../SendButton";

const handleSend = vi.fn();
vi.mock("../../../hooks/useSendMessage", () => ({
  useSendMessage: () => vi.fn(),
}));
vi.mock("../../../hooks/useSendWithEnter", () => ({
  useSendWithEnter: () => true,
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

const makeState = (settings) => ({
  settings: {
    model: { name: "Internal", input: [] },
    tools: {},
    ...settings,
  },
  messages: [
    { role: "user", content: [{ type: "text", text: "hello" }] },
  ],
});

describe("SendButton", () => {
  it("shows the safe tone and sends on click", () => {
    const { container } = render(
      <SendButton
        localState={makeState({})}
        setLocalState={vi.fn()}
        handleSend={handleSend}
        prompt="hello"
      />,
    );
    const icon = container.querySelector('[data-guide="send"]');
    expect(icon).toHaveClass("text-success");
    fireEvent.click(icon);
    expect(handleSend).toHaveBeenCalled();
  });

  it("warns when MCP is enabled", () => {
    const { container } = render(
      <SendButton
        localState={makeState({ tools: { mcp: true } })}
        setLocalState={vi.fn()}
        handleSend={vi.fn()}
        prompt="hello"
      />,
    );
    expect(container.querySelector('[data-guide="send"]')).toHaveClass("text-warning");
  });
});
