import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MountFolderButton from "../MountFolderButton";

const workspaceMocks = vi.hoisted(() => ({ canMount: false }));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => true,
  modelSupportsTools: () => true,
}));
vi.mock("../../../agent/mcp", () => ({
  hasLocalMcpServerValue: () => false,
  isRemoteMcpServer: () => false,
  mcpServers: () => [],
}));
vi.mock("../../../agent/workspace", () => ({
  canMountLocalDirectory: () => workspaceMocks.canMount,
  mountLocalDirectory: vi.fn(),
  setAccessPrompt: vi.fn(),
}));

const stateWith = (tools) => ({
  id: "conversation",
  settings: { model: { id: "test-model" }, tools },
});

const openPanel = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Browser & local tools" }),
  );
};

describe("MountFolderButton bulk actions", () => {
  it("marks the local MCP server button as a data-transfer risk", () => {
    render(<MountFolderButton localState={stateWith({})} setLocalState={vi.fn()} />);
    openPanel();

    const button = screen.getByRole("button", { name: /mcp server/i });
    expect(button.querySelector("svg.lucide-triangle-alert")).toBeTruthy();
  });

  it("enables every local tool", () => {
    workspaceMocks.canMount = true;
    const localState = stateWith({ browser_storage: false, mcp: false, create_docx: false, codemode: false, image_analysis: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /enable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools).toMatchObject({
      browser_storage: true,
      mcp: true,
      create_docx: true,
      codemode: true,
      image_analysis: true,
      write_access: true,
    });
  });

  it("hides write access when a local folder cannot be shared", () => {
    workspaceMocks.canMount = false;
    render(<MountFolderButton localState={stateWith({})} setLocalState={vi.fn()} />);
    openPanel();

    expect(screen.queryByRole("button", { name: /allow write/i })).not.toBeInTheDocument();
  });

  it("disables every local tool", () => {
    workspaceMocks.canMount = true;
    const localState = stateWith({ browser_storage: true, mcp: true, create_docx: true, codemode: true, image_analysis: true, write_access: true });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /disable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools).toMatchObject({
      browser_storage: false,
      mcp: false,
      create_docx: false,
      codemode: false,
      image_analysis: false,
      write_access: false,
    });
  });

  it("toggles browser storage access", () => {
    const localState = stateWith({ browser_storage: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /browser storage/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools.browser_storage).toBe(true);
  });

  it("toggles image analysis with the Gemma vision tool", () => {
    const localState = stateWith({ image_analysis: true });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<MountFolderButton localState={localState} setLocalState={setLocalState} />);
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: /analyze images/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.tools.image_analysis).toBe(false);
  });
});
