import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ToolsContainer from "../ToolsContainer";

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: () => true,
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

const stateWith = (tools) => ({
  settings: {
    enable_tools: true,
    model: { id: "test-model", name: "Test Model" },
    tools,
  },
});

describe("ToolsContainer MCP switch", () => {
  it("toggles the remote MCP flag without changing the local one", () => {
    const localState = stateWith({ mcp: true, mcp_remote: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("button", { name: /mcp server/i }));

    expect(setLocalState).toHaveBeenCalled();
    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.mcp_remote).toBe(true);
    expect(next.settings.tools.mcp).toBe(true);
  });

  it("shows the remote MCP configuration only when its flag is on", () => {
    const localState = stateWith({ mcp: true, mcp_remote: false });
    render(<ToolsContainer localState={localState} setLocalState={vi.fn()} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("marks the remote MCP button as a data-transfer risk", () => {
    const localState = stateWith({ mcp: true, mcp_remote: false });
    render(<ToolsContainer localState={localState} setLocalState={vi.fn()} />);

    const button = screen.getByRole("button", { name: /mcp server/i });
    expect(button.querySelector("svg.lucide-triangle-alert")).toBeTruthy();
  });
});

describe("ToolsContainer bulk actions", () => {
  it("enables every tool and the master switch", () => {
    const localState = stateWith({ web_search: false, mcp_remote: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("button", { name: /enable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.enable_tools).toBe(true);
    for (const key of [
      "web_search",
      "fetch_url",
      "image_generation",
      "image_modification",
      "audio_generation",
      "arcana",
      "mcp_remote",
    ]) {
      expect(next.settings.tools[key]).toBe(true);
    }
  });

  it("disables every tool while keeping the master switch", () => {
    const localState = stateWith({ web_search: true, mcp_remote: true });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("button", { name: /disable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.enable_tools).toBe(true);
    for (const key of [
      "web_search",
      "fetch_url",
      "image_generation",
      "image_modification",
      "audio_generation",
      "arcana",
      "mcp_remote",
    ]) {
      expect(next.settings.tools[key]).toBe(false);
    }
  });
});
