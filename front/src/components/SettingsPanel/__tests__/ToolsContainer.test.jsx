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
  it("hides the configured server list while MCP Servers is disabled", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", kind: "local", url: "http://localhost:9000/mcp" },
    ];
    render(<ToolsContainer localState={stateWith({})} setLocalState={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "MCP Servers settings" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Files")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="mcp-server-picker"]'),
    ).not.toBeInTheDocument();
  });

  it("enables both MCP backends from the MCP Servers tool", () => {
    const localState = stateWith({ mcp: false, mcp_remote: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("switch", { name: /mcp servers/i }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.mcp).toBe(true);
    expect(next.settings.tools.mcp_remote).toBe(true);
    expect(document.querySelector('[data-guide="tools-grid"]')).toBeInTheDocument();
  });

  it("lists configured local and remote servers with their kind", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", kind: "local", url: "http://localhost:9000/mcp" },
      { id: "r1", name: "Gateway", kind: "remote", serverId: "server-1" },
    ];
    render(
      <ToolsContainer localState={stateWith({ mcp: true })} setLocalState={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "MCP Servers settings" }),
    );

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Gateway")).toBeInTheDocument();
    expect(screen.getByText("GWDG")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
  });

  it("selects a local server for the chat", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", kind: "local", url: "http://localhost:9000/mcp" },
    ];
    const localState = stateWith({ mcp: true });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(
      screen.getByRole("button", { name: "MCP Servers settings" }),
    );

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
    const localState = stateWith({ mcp: true, mcp_remote: true });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(
      screen.getByRole("button", { name: "MCP Servers settings" }),
    );

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
    render(
      <ToolsContainer localState={stateWith({ mcp: true })} setLocalState={vi.fn()} />,
    );

    const row = screen.getByRole("button", { name: "MCP Servers settings" });
    expect(row.querySelector("svg.lucide-triangle-alert")).toBeTruthy();
    fireEvent.click(row);

    const picker = document.querySelector('[data-guide="mcp-server-picker"]');
    expect(picker?.querySelector("svg.lucide-triangle-alert")).toBeTruthy();
  });
});

describe("ToolsContainer detail pages", () => {
  it("opens the Arcana page and returns to the list with Back", () => {
    render(
      <ToolsContainer
        localState={stateWith({ arcana: true })}
        setLocalState={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Arcana settings" }));

    expect(screen.getByPlaceholderText("Arcana id")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /enable all/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.queryByPlaceholderText("Arcana id")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="tools-grid"]'),
    ).toBeInTheDocument();
  });

  it("toggles Arcana from its switch without opening the page", () => {
    const localState = stateWith({});
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("switch", { name: "Arcana" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.arcana).toBe(true);
    expect(screen.queryByPlaceholderText("Arcana id")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="tools-grid"]'),
    ).toBeInTheDocument();
  });

  it("keeps a row without settings as a plain toggle row", () => {
    const localState = stateWith({});
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    const row = screen.getByRole("button", { name: "Image Generation" });
    fireEvent.click(row);

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.image_generation).toBe(true);
    expect(
      screen.queryByRole("button", { name: /image generation settings/i }),
    ).not.toBeInTheDocument();
    expect(
      row.parentElement?.querySelector("svg.lucide-chevron-right"),
    ).toBeNull();
  });

  it("asks to enable Arcana before showing its settings", () => {
    render(<ToolsContainer localState={stateWith({})} setLocalState={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Arcana settings" }));

    expect(
      screen.getByText("Turn this tool on to configure it."),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Arcana id")).not.toBeInTheDocument();
  });

  it("keeps the page honest while the master tools switch is off", () => {
    const localState = {
      settings: {
        enable_tools: false,
        model: { id: "test-model", name: "Test Model" },
        tools: { arcana: true },
      },
    };
    render(<ToolsContainer localState={localState} setLocalState={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Arcana settings" }));

    expect(
      screen.getByText("Turn this tool on to configure it."),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Arcana id")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Arcana" })).toBeDisabled();
  });
});

describe("ToolsContainer Arcana Tools", () => {
  it("makes Arcana Tools available in agent mode", () => {
    agentMocks.agent = true;
    const localState = stateWith({ arcana_tools: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    const button = screen.getByRole("button", { name: /arcana tools/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.arcana_tools).toBe(true);
  });

  it("toggles Arcana Tools independently", () => {
    const localState = stateWith({ arcana_tools: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("button", { name: /arcana tools/i }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.arcana_tools).toBe(true);
  });

  it("hides both Arcana tools when the arcanas module is off", () => {
    const original = import.meta.env.VITE_MODULE_ARCANAS;
    import.meta.env.VITE_MODULE_ARCANAS = "false";
    try {
      render(
        <ToolsContainer
          localState={stateWith({ arcana: true, arcana_tools: true })}
          setLocalState={vi.fn()}
        />
      );

      expect(screen.queryByRole("button", { name: /arcana tools/i })).not.toBeInTheDocument();
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
      "arcana_tools",
      "arcana",
      "mcp",
      "mcp_remote",
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
      "arcana_tools",
      "arcana",
      "mcp",
      "mcp_remote",
    ]) {
      expect(next.settings.tools[key]).toBe(false);
    }
  });
});

describe("ToolsContainer list layout", () => {
  it("lists each tool as a row whose switch shows whether it is on", () => {
    render(
      <ToolsContainer
        localState={stateWith({ image_generation: true })}
        setLocalState={vi.fn()}
      />,
    );

    const list = document.querySelector('[data-guide="tools-grid"]');
    expect(list?.tagName).toBe("UL");

    const rows = Array.from(list?.querySelectorAll("li") ?? []);
    const toolButtons = Array.from(
      list?.querySelectorAll('[data-guide^="tool-"]') ?? [],
    );
    expect(rows).toHaveLength(toolButtons.length);
    for (const row of rows) {
      expect(row.querySelector('input[type="checkbox"]')).toBeTruthy();
    }

    const on = screen.getByRole("button", { name: /image generation/i });
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(on.querySelector('input[type="checkbox"]')).toBeChecked();
    expect(on.parentElement?.tagName).toBe("LI");

    const off = screen.getByRole("button", { name: /image modification/i });
    expect(off).toHaveAttribute("aria-pressed", "false");
    expect(off.querySelector('input[type="checkbox"]')).not.toBeChecked();
  });

  it("disables every row while each switch keeps its own tools state", () => {
    render(
      <ToolsContainer
        localState={{
          settings: {
            enable_tools: false,
            model: { id: "m", name: "Test Model" },
            tools: { image_generation: true, image_modification: false },
          },
        }}
        setLocalState={vi.fn()}
      />,
    );

    const rows = Array.from(
      document.querySelectorAll('[data-guide="tools-grid"] > li'),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const control =
        row.querySelector('button[role="switch"]') ?? row.querySelector("button");
      expect(control).toBeDisabled();
      expect(control?.querySelector('input[type="checkbox"]')).toBeDisabled();
    }

    const on = screen.getByRole("button", { name: /image generation/i });
    expect(on).toBeDisabled();
    expect(on).toHaveAttribute("aria-pressed", "true");
    expect(on.querySelector('input[type="checkbox"]')).toBeChecked();

    const off = screen.getByRole("button", { name: /image modification/i });
    expect(off).toBeDisabled();
    expect(off).toHaveAttribute("aria-pressed", "false");
    expect(off.querySelector('input[type="checkbox"]')).not.toBeChecked();
  });
});
