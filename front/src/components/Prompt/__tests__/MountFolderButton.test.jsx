import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MountFolderButton from "../MountFolderButton";

const workspaceMocks = vi.hoisted(() => ({ attached: false }));

vi.mock("../../../db/workspaceDb", () => ({
  useChatWorkspaces: () =>
    workspaceMocks.attached ? [{ workspaceId: "workspace-1" }] : [],
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => true,
  modelSupportsTools: () => true,
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../agent/mcp", () => ({
  hasLocalMcpServerValue: () => false,
  isRemoteMcpServer: () => false,
  mcpServers: () => [],
}));

const stateWith = (tools) => ({
  id: "conversation",
  settings: { model: { id: "test-model" }, tools },
});

const openPanel = () => {
  fireEvent.click(screen.getByRole("button", { name: "Browser & local tools" }));
};

describe("MountFolderButton bulk actions", () => {
  beforeEach(() => {
    workspaceMocks.attached = false;
  });

  it("marks the local MCP server button as a data-transfer risk", () => {
    render(<MountFolderButton localState={stateWith({})} setLocalState={vi.fn()} />);
    openPanel();

    const button = screen.getByRole("button", { name: /mcp server/i });
    expect(button.querySelector("svg.lucide-triangle-alert")).toBeTruthy();
  });

  it("no longer offers browser storage or sharing a local folder", () => {
    render(<MountFolderButton localState={stateWith({})} setLocalState={vi.fn()} />);
    openPanel();

    expect(
      screen.queryByRole("button", { name: /browser storage/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /share local folder/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /allow write/i }),
    ).not.toBeInTheDocument();
  });

  it("disables file tools without an attached workspace", () => {
    render(<MountFolderButton localState={stateWith({})} setLocalState={vi.fn()} />);
    openPanel();

    expect(screen.getByRole("button", { name: /word document/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /analyze images/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /codemode/i })).not.toBeDisabled();
  });

  it("enables file tools when a workspace is attached", () => {
    workspaceMocks.attached = true;
    render(<MountFolderButton localState={stateWith({})} setLocalState={vi.fn()} />);
    openPanel();

    expect(
      screen.getByRole("button", { name: /word document/i }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: /analyze images/i }),
    ).not.toBeDisabled();
  });

  it("enables every local tool with a workspace attached", () => {
    workspaceMocks.attached = true;
    const localState = stateWith({
      mcp: false,
      create_docx: false,
      codemode: false,
      image_analysis: false,
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /enable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools).toMatchObject({
      mcp: true,
      create_docx: true,
      codemode: true,
      image_analysis: true,
    });
    expect(next.settings.tools.browser_storage).toBeUndefined();
    expect(next.settings.tools.write_access).toBeUndefined();
  });

  it("does not enable file tools without a workspace", () => {
    const localState = stateWith({
      mcp: false,
      create_docx: false,
      codemode: false,
      image_analysis: false,
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /enable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools).toMatchObject({ mcp: true, codemode: true });
    expect(next.settings.tools.create_docx).toBe(false);
    expect(next.settings.tools.image_analysis).toBe(false);
  });

  it("disables every local tool", () => {
    workspaceMocks.attached = true;
    const localState = stateWith({
      mcp: true,
      create_docx: true,
      codemode: true,
      image_analysis: true,
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /disable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools).toMatchObject({
      mcp: false,
      create_docx: false,
      codemode: false,
      image_analysis: false,
    });
  });

  it("toggles image analysis with the Gemma vision tool", () => {
    workspaceMocks.attached = true;
    const localState = stateWith({ image_analysis: true });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /analyze images/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools.image_analysis).toBe(false);
  });
});
