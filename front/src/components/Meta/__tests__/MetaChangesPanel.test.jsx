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

  it("renders no tab strip without tabs", () => {
    render(
      <MemoryRouter>
        <MetaChangesPanel userSettings={{}} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getAllByText("What's new")).toHaveLength(1);
  });

  it("switches between the changes and files tabs", () => {
    render(
      <MemoryRouter>
        <MetaChangesPanel
          userSettings={{}}
          tabs={[
            {
              id: "files",
              label: "Files",
              content: <div>Workspace files content</div>,
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("tablist")).toHaveAttribute(
      "data-guide",
      "meta-tab-strip",
    );
    expect(screen.getByRole("tab", { name: "What's new" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.queryByText("Workspace files content")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Chat title" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Files" }));

    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Workspace files content")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chat title" })).toBeNull();
  });

  it("shows Check now only on the What's new tab", () => {
    render(
      <MemoryRouter>
        <MetaChangesPanel
          userSettings={{}}
          tabs={[
            { id: "files", label: "Files", content: <div>Files view</div> },
          ]}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: "Check now" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    expect(screen.queryByRole("button", { name: "Check now" })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "What's new" }));
    expect(
      screen.getByRole("button", { name: "Check now" }),
    ).toBeInTheDocument();
  });

  it("renders three tabs and only the active tab's content", () => {
    render(
      <MemoryRouter>
        <MetaChangesPanel
          userSettings={{}}
          tabs={[
            { id: "files", label: "Files", content: <div>Files content</div> },
            {
              id: "settings",
              label: "Settings",
              content: <div>Settings content</div>,
            },
            { id: "logs", label: "Logs", content: <div>Logs content</div> },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute(
      "data-guide",
      "meta-tab-files",
    );
    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
      "data-guide",
      "meta-tab-settings",
    );
    expect(screen.getByRole("tab", { name: "Logs" })).toHaveAttribute(
      "data-guide",
      "meta-tab-logs",
    );

    expect(screen.queryByText("Files content")).toBeNull();
    expect(screen.queryByText("Settings content")).toBeNull();
    expect(screen.queryByText("Logs content")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Chat title" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    expect(screen.getByText("Files content")).toBeInTheDocument();
    expect(screen.queryByText("Settings content")).toBeNull();
    expect(screen.queryByText("Logs content")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.queryByText("Files content")).toBeNull();
    expect(screen.getByText("Settings content")).toBeInTheDocument();
    expect(screen.queryByText("Logs content")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Logs" }));
    expect(screen.queryByText("Files content")).toBeNull();
    expect(screen.queryByText("Settings content")).toBeNull();
    expect(screen.getByText("Logs content")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chat title" })).toBeNull();
  });
});
