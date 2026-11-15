import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import MetaChangesPanel from "../MetaChangesPanel";
import { getWhatsNew } from "../../../utils/metaTools";

vi.mock("../../../utils/metaTools", () => ({
  getWhatsNew: vi.fn(async () => "Scoped session result"),
}));

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
  beforeEach(() => {
    vi.mocked(getWhatsNew).mockClear();
  });

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

  it("keeps a workspace-scoped result separate from the global Meta result", () => {
    localStorage.setItem(
      "chatai.meta.last-check-result:ws-1",
      JSON.stringify({ at: Date.now(), text: "Scoped workspace report" }),
    );

    render(
      <MemoryRouter>
        <MetaChangesPanel
          userSettings={{}}
          scope={{ agentIds: ["agent-1"] }}
          scopeKey="ws-1"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Scoped workspace report")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chat title" })).toBeNull();
  });

  it("checks only the scoped data and stores it under the scope key", async () => {
    const scope = {
      agentIds: ["agent-1"],
      sessionIds: { "agent-1": ["session-1"] },
      conversationIds: ["chat-1"],
    };
    render(
      <MemoryRouter>
        <MetaChangesPanel userSettings={{}} scope={scope} scopeKey="ws-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Check now" }));

    await waitFor(() =>
      expect(getWhatsNew).toHaveBeenCalledWith(
        expect.objectContaining({ scope }),
      ),
    );
    expect(await screen.findByText("Scoped session result")).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("chatai.meta.last-check-result:ws-1"))
        .text,
    ).toBe("Scoped session result");
    expect(
      JSON.parse(localStorage.getItem("chatai.meta.last-check-result")).text,
    ).not.toContain("Scoped session result");
  });
});
