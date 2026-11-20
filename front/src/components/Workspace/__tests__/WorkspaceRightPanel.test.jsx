import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router";

import { FilePreviewProvider, useFilePreview } from "../../../context/FilePreviewContext";
import WorkspaceRightPanel from "../WorkspaceRightPanel";

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));

vi.mock("../../../utils/metaTools", () => ({
  getWhatsNew: vi.fn(async () => ""),
}));

vi.mock("../../../db", () => ({
  loadFile: vi.fn(async () => null),
  useFileMeta: () => ({ name: "chat.md", type: "text/markdown", size: 9 }),
  useFile: () => ({ data: null }),
  useFileBase64: () => "",
  useFileContent: () => "from the chat",
}));

const workspaceMocks = vi.hoisted(() => ({
  rows: [{ id: "ws-1", name: "One" }],
}));

vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => workspaceMocks.rows,
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

// The tree is covered by its own test; here it only has to report a click.
vi.mock("../WorkspaceStorageTree", () => ({
  default: ({ onPreview }) => (
    <button
      type="button"
      onClick={() =>
        onPreview({
          entry: { name: "notes.txt", mime: "text/plain", size: 5 },
          text: "hello from the files tree",
        })
      }
    >
      notes.txt
    </button>
  ),
}));

vi.mock("../WorkspaceAgentPanel", () => ({
  default: () => <div data-testid="agent-panel" />,
}));

function OpenChatFile() {
  const { toggleFilePreview } = useFilePreview();
  return (
    <button
      type="button"
      onClick={() => toggleFilePreview({ fileId: "chat-1", name: "chat.md" })}
    >
      open chat file
    </button>
  );
}

const renderPanel = (workspaceIds = ["ws-1"], entries) =>
  render(
    <MemoryRouter {...(entries ? { initialEntries: entries } : {})}>
      <FilePreviewProvider>
        <OpenChatFile />
        <WorkspaceRightPanel
          workspaceIds={workspaceIds}
          userSettings={{}}
          scope={null}
          scopeKey="ws-1"
        />
      </FilePreviewProvider>
    </MemoryRouter>,
  );

describe("WorkspaceRightPanel preview tab", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440,
    });
    localStorage.clear();
    localStorage.setItem("chatai.meta.changes-collapsed", "false");
    workspaceMocks.rows = [{ id: "ws-1", name: "One" }];
  });

  it("draws one Files section per workspace only when there are several", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: "Files" }));

    expect(screen.queryAllByTestId("files-workspace-heading")).toHaveLength(0);
  });

  it("heads each workspace's files and rules a line between them", () => {
    workspaceMocks.rows = [
      { id: "ws-1", name: "One" },
      { id: "ws-2", name: "Two" },
    ];
    const view = renderPanel(["ws-1", "ws-2"]);
    fireEvent.click(screen.getByRole("tab", { name: "Files" }));

    const headings = screen.getAllByTestId("files-workspace-heading");
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "One",
      "Two",
    ]);
    // Grey, all-capital section labels: the shared heading style of this panel.
    expect(headings[0].className).toContain("uppercase");
    expect(headings[0].className).toContain("text-base-content/45");
    // The first section has no rule above it; each later one does.
    expect(view.container.querySelectorAll("div.h-px.bg-base-300")).toHaveLength(
      1,
    );
  });

  it("shows the Preview tab only once a file is opened, and Back leaves it open", async () => {
    renderPanel();

    expect(
      screen.queryByRole("tab", { name: "Preview" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    fireEvent.click(screen.getByRole("button", { name: "notes.txt" }));

    expect(
      screen.getByRole("tab", { name: "Preview" }),
    ).toHaveAttribute("aria-selected", "true");
    await waitFor(() => {
      expect(screen.getByText("hello from the files tree")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    // Back is navigation, not closing: the tab stays in the strip, just not selected.
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // It can be reopened from the strip, and the file is still there.
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    await waitFor(() => {
      expect(screen.getByText("hello from the files tree")).toBeInTheDocument();
    });
  });

  it("removes the Preview tab only when it is closed with the X", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("tab", { name: "Files" }));
    fireEvent.click(screen.getByRole("button", { name: "notes.txt" }));
    await waitFor(() => {
      expect(screen.getByText("hello from the files tree")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(
      screen.queryByRole("tab", { name: "Preview" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens a file clicked in the chat in the same tab", async () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "open chat file" }));

    expect(
      screen.getByRole("tab", { name: "Preview" }),
    ).toHaveAttribute("aria-selected", "true");
    await waitFor(() => {
      expect(screen.getByText("from the chat")).toBeInTheDocument();
    });
  });
});

describe("WorkspaceRightPanel opening tab", () => {
  const narrowWindow = () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1024,
    });
    localStorage.removeItem("chatai.meta.changes-collapsed");
  };

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440,
    });
    localStorage.clear();
    localStorage.setItem("chatai.meta.changes-collapsed", "false");
    workspaceMocks.rows = [{ id: "ws-1", name: "One" }];
  });

  it("lands on the Files tab instead of What's New", () => {
    renderPanel();

    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "What's New" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("button", { name: "notes.txt" })).toBeInTheDocument();
  });

  it("unfolds the rail when the arrival asked for the panel", () => {
    narrowWindow();
    renderPanel(
      ["ws-1"],
      [{ pathname: "/workspace/ws-1", state: { openWorkspacePanel: true } }],
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Unfolding is part of the arrival, not a change of the stored preference.
    expect(localStorage.getItem("chatai.meta.changes-collapsed")).toBeNull();
  });

  it("keeps the user's rail on a plain arrival", () => {
    narrowWindow();
    renderPanel(["ws-1"], [{ pathname: "/workspace/ws-1" }]);

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Expand What's New" }),
    ).toBeInTheDocument();
  });

  it("spends the intent on its own arrival, so a reload keeps the rail", async () => {
    const StateProbe = () => (
      <span data-testid="router-state">
        {JSON.stringify(useLocation().state?.openWorkspacePanel)}
      </span>
    );
    narrowWindow();
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/workspace/ws-1", state: { openWorkspacePanel: true } },
        ]}
      >
        <FilePreviewProvider>
          <WorkspaceRightPanel
            workspaceIds={["ws-1"]}
            userSettings={{}}
            scope={null}
            scopeKey="ws-1"
          />
          <StateProbe />
        </FilePreviewProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("router-state")).toHaveTextContent("false"),
    );
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
