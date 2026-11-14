import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToolsContainer from "../ToolsContainer";

const agentMocks = vi.hoisted(() => ({ agent: false, gateway: true }));
const mcpMocks = vi.hoisted(() => ({ servers: [] }));

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) =>
    selector({
      user_settings: { mcp_servers: mcpMocks.servers },
      interface_settings: { agree_web_search: true },
    }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => agentMocks.agent,
  agentGatewayTools: () => agentMocks.gateway,
  modelSupportsTools: () => true,
}));

beforeEach(() => {
  agentMocks.agent = false;
  agentMocks.gateway = true;
  mcpMocks.servers = [];
});

const stateWith = (tools) => ({
  settings: {
    enable_tools: true,
    model: { id: "test-model", name: "Test Model" },
    tools,
  },
});

describe("ToolsContainer MCP selector", () => {
  it("lists configured local and remote servers with their kind", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", kind: "local", url: "http://localhost:9000/mcp" },
      { id: "r1", name: "Gateway", kind: "remote", serverId: "server-1" },
    ];
    render(<ToolsContainer localState={stateWith({})} setLocalState={vi.fn()} />);

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("GWDG")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("GWDG")).toBeInTheDocument();
  });

  it("selects a local server for the chat", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", kind: "local", url: "http://localhost:9000/mcp" },
    ];
    const localState = stateWith({});
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    const picker = document.querySelector('[data-guide="mcp-server-picker"]');
    fireEvent.click(picker.querySelector('input[type="checkbox"]'));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.mcp_local_server_ids).toEqual(["l1"]);
    expect(next.settings.tools.mcp).toBe(true);
  });

  it("selects a remote server for the chat", () => {
    mcpMocks.servers = [
      { id: "r1", name: "Gateway", kind: "remote", serverId: "server-1" },
    ];
    const localState = stateWith({});
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    const picker = document.querySelector('[data-guide="mcp-server-picker"]');
    fireEvent.click(picker.querySelector('input[type="checkbox"]'));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.mcp_remote_server_ids).toEqual(["r1"]);
    expect(next.settings.tools.mcp_remote).toBe(true);
  });

  it("marks the MCP selector as a data-transfer risk", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", kind: "local", url: "http://localhost:9000/mcp" },
    ];
    render(<ToolsContainer localState={stateWith({})} setLocalState={vi.fn()} />);

    const picker = document.querySelector('[data-guide="mcp-server-picker"]');
    expect(picker?.querySelector("svg.lucide-triangle-alert")).toBeTruthy();
  });
});

describe("ToolsContainer ArcanaV2", () => {
  it("makes ArcanaV2 available in agent mode", () => {
    agentMocks.agent = true;
    const localState = stateWith({ arcana_v2: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    const button = screen.getByRole("button", { name: /arcanav2/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.arcana_v2).toBe(true);
  });

  it("toggles ArcanaV2 independently", () => {
    const localState = stateWith({ arcana_v2: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("button", { name: /arcanav2/i }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.arcana_v2).toBe(true);
  });

  it("hides both Arcana tools when the arcanas module is off", () => {
    const original = import.meta.env.VITE_MODULE_ARCANAS;
    import.meta.env.VITE_MODULE_ARCANAS = "false";
    try {
      render(
        <ToolsContainer
          localState={stateWith({ arcana: true, arcana_v2: true })}
          setLocalState={vi.fn()}
        />
      );

      expect(screen.queryByRole("button", { name: /arcanav2/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^arcana$/i })).not.toBeInTheDocument();
    } finally {
      import.meta.env.VITE_MODULE_ARCANAS = original;
    }
  });
});

describe("ToolsContainer bulk actions", () => {
  it("enables every tool and the master switch", () => {
    const localState = stateWith({ web_search: false });
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
      "arcana_v2",
      "arcana",
    ]) {
      expect(next.settings.tools[key]).toBe(true);
    }
  });

  it("disables every tool while keeping the master switch", () => {
    const localState = stateWith({ web_search: true });
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
      "arcana_v2",
      "arcana",
    ]) {
      expect(next.settings.tools[key]).toBe(false);
    }
  });
});
