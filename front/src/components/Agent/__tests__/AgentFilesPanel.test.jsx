import { fireEvent, render, screen } from "@testing-library/react";
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

const renderPanel = (props = {}) =>
  render(
    <AgentFilesPanel
      agent={agent}
      workspaces={workspaces}
      onOpenFile={vi.fn()}
      onShowText={vi.fn()}
      {...props}
    />,
  );

beforeEach(() => {
  mocks.list.mockReset();
  mocks.find.mockReset();
  mocks.read.mockReset();
  mocks.list.mockResolvedValue([]);
  mocks.read.mockRejectedValue(new Error("not found"));
});

describe("AgentFilesPanel workspace access", () => {
  it("switches agent workspace access on and off", () => {
    const onBridgeEnabledChange = vi.fn();
    renderPanel({ bridgeEnabled: false, onBridgeEnabledChange });

    const toggle = screen.getByRole("switch", {
      name: "Agent workspace access",
    });
    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText(/The agent cannot see workspace files/),
    ).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(onBridgeEnabledChange).toHaveBeenCalledWith(true);
  });

  it("shows the workspace settings only while access is on", () => {
    const { rerender } = renderPanel({ bridgeEnabled: false });
    expect(screen.queryByLabelText("Workspace")).not.toBeInTheDocument();

    rerender(
      <AgentFilesPanel
        agent={agent}
        workspaces={workspaces}
        bridgeEnabled
        workspaceId="ws-1"
        bridgeWritable
        onOpenFile={vi.fn()}
        onShowText={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Workspace")).toHaveValue("ws-1");
    expect(screen.getByLabelText("Allow writes")).toBeChecked();
  });

  it("cannot be switched on without a workspace", () => {
    renderPanel({ workspaces: [], bridgeEnabled: false });

    expect(
      screen.getByRole("switch", { name: "Agent workspace access" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Create or attach a workspace first/),
    ).toBeInTheDocument();
  });
});
