import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let userSettings = { collapse_reasoning_while_streaming: true };
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: userSettings, interface_settings: {} }),
}));

import ThinkingBlock from "../ThinkingBlock";
import MarkdownRenderer from "../MarkdownRenderer";

describe("ThinkingBlock streaming status", () => {
  it("lets the user expand the reasoning content while streaming", async () => {
    render(
      <ThinkingBlock autoExpand isStreaming>
        {"First thought"}
      </ThinkingBlock>,
    );

    const header = screen.getByRole("button", { name: /^Reasoning Process/ });
    expect(header).not.toBeDisabled();
    expect(screen.queryByText("First thought")).not.toBeInTheDocument();

    fireEvent.click(header);
    await waitFor(() =>
      expect(screen.getByText("First thought")).toBeInTheDocument(),
    );
  });

  it("updates the received word count while streaming", async () => {
    const { rerender } = render(
      <ThinkingBlock autoExpand isStreaming>
        {"First thought"}
      </ThinkingBlock>,
    );

    expect(
      screen.getByText(/2 (words received|Wörter empfangen)/),
    ).toBeInTheDocument();

    rerender(
      <ThinkingBlock autoExpand isStreaming>
        {"First thought and more words"}
      </ThinkingBlock>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/5 (words received|Wörter empfangen)/),
      ).toBeInTheDocument(),
    );
  });

  it("never renders code fences as render tools", async () => {
    const content = [
      "```html",
      "<h1>Injected</h1>",
      "```",
      "",
      "```typst",
      "#set page(fill: red)",
      "```",
      "",
      "```mermaid",
      "graph TD; A-->B",
      "```",
    ].join("\n");

    const { container } = render(
      <ThinkingBlock>{content}</ThinkingBlock>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Reasoning Process/ }));

    await waitFor(() => {
      expect(container.textContent).toContain("Injected");
      expect(container.textContent).toContain("#set page(fill: red)");
      expect(container.textContent).toContain("graph TD; A-->B");
    });
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Render/ })).toBeNull();
  });

  it("never renders code fences in thinking blocks in Markdown mode", async () => {
    const content =
      "\u003cthink>\n```html\n<h1>Injected</h1>\n```\n\u003c/think>\n\nAnswer";

    const { container } = render(
      <MarkdownRenderer renderMode="Markdown">{content}</MarkdownRenderer>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Reasoning Process/ }));

    await waitFor(() => {
      expect(container.textContent).toContain("Injected");
      expect(container.textContent).toContain("Answer");
    });
    expect(container.querySelector("iframe")).toBeNull();
  });
});
