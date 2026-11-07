import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let userSettings = { collapse_reasoning_while_streaming: true };
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: userSettings, interface_settings: {} }),
}));

import ThinkingBlock from "../ThinkingBlock";

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
});
