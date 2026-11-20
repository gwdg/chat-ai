import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

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

vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => [{ id: "ws-1", name: "One" }],
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

const renderPanel = () =>
  render(
    <MemoryRouter>
      <FilePreviewProvider>
        <OpenChatFile />
        <WorkspaceRightPanel
          workspaceIds={["ws-1"]}
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
  });

  it("shows the Preview tab only once a file is opened, and goes back", async () => {
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
