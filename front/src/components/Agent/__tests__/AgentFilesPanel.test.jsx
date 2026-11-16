import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  find: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  shell: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../apis/opencodeAgents", () => ({
  findOpencodeFiles: (...args) => mocks.find(...args),
  isAgentServerUnavailable: (error) =>
    error?.code === "AGENT_SERVER_UNAVAILABLE",
  listOpencodeFiles: (...args) => mocks.list(...args),
  readOpencodeFile: (...args) => mocks.read(...args),
  runOpencodeShellAndWait: (...args) => mocks.shell(...args),
  writeOpencodeFile: (...args) => mocks.write(...args),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({
    notifySuccess: mocks.notifySuccess,
    notifyError: mocks.notifyError,
  }),
}));

import AgentFilesPanel from "../AgentFilesPanel";

const agent = { id: "agent-1", name: "Example agent" };
const workspaces = [{ id: "ws-1", name: "Example project" }];

beforeEach(() => {
  mocks.list.mockReset();
  mocks.find.mockReset();
  mocks.read.mockReset();
  mocks.list.mockResolvedValue([]);
  mocks.read.mockRejectedValue(new Error("not found"));
});

describe("AgentFilesPanel", () => {
  it("keeps workspace access out of the file panel", () => {
    // The switch, the workspace choice and the write/MCP options live in the composer's
    // workspace popover, so the panel is only the file browser.
    render(
      <AgentFilesPanel
        agent={agent}
        workspaces={workspaces}
        bridgeEnabled
        onOpenFile={vi.fn()}
        onShowText={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("switch", { name: "Agent workspace access" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Allow writes")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="agent-bridge-toggle"]'),
    ).toBeNull();
    expect(document.querySelector('[data-guide="agent-files"]')).not.toBeNull();
  });

  it("hides the file list while the agent server is unavailable", async () => {
    mocks.list.mockRejectedValueOnce(
      Object.assign(new Error("The agent server is unavailable."), {
        code: "AGENT_SERVER_UNAVAILABLE",
      }),
    );

    const { container, rerender } = render(
      <AgentFilesPanel
        agent={agent}
        workspaces={workspaces}
        onOpenFile={vi.fn()}
        onShowText={vi.fn()}
      />,
    );

    // No panel, and no JSON parse error standing in for a file list.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();

    // The next successful load brings it back.
    rerender(
      <AgentFilesPanel
        agent={{ id: "agent-2", name: "Recovered agent" }}
        workspaces={workspaces}
        onOpenFile={vi.fn()}
        onShowText={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(document.querySelector('[data-guide="agent-files"]')).not.toBeNull(),
    );
  });
});
