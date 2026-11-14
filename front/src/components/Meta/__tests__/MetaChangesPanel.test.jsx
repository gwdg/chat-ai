import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import MetaChangesPanel from "../MetaChangesPanel";

vi.mock("../../../hooks/useMetaChatSend", () => ({
  META_LAST_CHECK_KEY: "chatai.meta.last-check",
  META_LAST_CHECK_RESULT_KEY: "chatai.meta.last-check-result",
}));

beforeEach(() => {
  localStorage.clear();
  const at = Date.now();
  localStorage.setItem("chatai.meta.last-check", String(at));
  localStorage.setItem(
    "chatai.meta.last-check-result",
    JSON.stringify({
      at,
      text: [
        "- [Chat title](/chat/chat-1)",
        "- [Session title](/agent/agent-1?session=session-1)",
        "- [report.md](/agent/agent-1?file=report.md)",
      ].join("\n"),
    }),
  );
});

describe("MetaChangesPanel", () => {
  it("renders what's new links as plain blue links instead of cards", () => {
    render(
      <MemoryRouter>
        <MetaChangesPanel userSettings={{}} />
      </MemoryRouter>,
    );

    for (const name of ["Chat title", "Session title", "report.md"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveClass("text-info");
      expect(link).not.toHaveClass("btn-accent");
      expect(link.querySelector("svg")).toBeNull();
    }
  });
});
