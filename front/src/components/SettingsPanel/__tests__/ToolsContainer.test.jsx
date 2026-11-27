import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToolsContainer from "../ToolsContainer";

const agentMocks = vi.hoisted(() => ({ agent: false, gateway: true }));
const mcpMocks = vi.hoisted(() => ({ servers: [], policy: "ask" }));

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) =>
    selector({
      user_settings: {
        mcp_servers: mcpMocks.servers,
        mcp_tool_policy: mcpMocks.policy,
      },
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
  mcpMocks.policy = "ask";
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
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
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

  it("enables the MCP tool from the MCP Servers switch", () => {
    const localState = stateWith({ mcp: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("switch", { name: /mcp servers/i }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.mcp).toBe(true);
    expect("mcp_remote" in next.settings.tools).toBe(false);
    expect(document.querySelector('[data-guide="tools-grid"]')).toBeInTheDocument();
  });

  it("selects every configured server when MCP is turned on without a selection", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
      { id: "l2", url: "http://localhost:9100/mcp" },
    ];
    const localState = stateWith({ mcp: false });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("switch", { name: /mcp servers/i }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.mcp).toBe(true);
    expect(next.settings.mcp_local_server_ids).toEqual(["l1", "l2"]);
  });

  it("keeps an explicit MCP server selection when MCP is turned on again", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
      { id: "l2", url: "http://localhost:9100/mcp" },
    ];
    const localState = {
      settings: {
        enable_tools: true,
        model: { id: "test-model", name: "Test Model" },
        tools: { mcp: false },
        mcp_local_server_ids: ["l2"],
      },
    };
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("switch", { name: /mcp servers/i }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.mcp_local_server_ids).toEqual(["l2"]);
  });

  it("selects every configured server from Enable all as well", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
    ];
    const localState = stateWith({});
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("button", { name: /enable all/i }));

    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.mcp_local_server_ids).toEqual(["l1"]);
  });

  it("does not select the global servers for a chat with legacy per-chat servers", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
    ];
    const localState = {
      settings: {
        enable_tools: true,
        model: { id: "test-model", name: "Test Model" },
        tools: { mcp: false },
        mcp_servers: [{ url: "http://localhost:9200/mcp", enabled: true }],
      },
    };
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(screen.getByRole("switch", { name: /mcp servers/i }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.tools.mcp).toBe(true);
    expect(next.settings.mcp_local_server_ids).toBeUndefined();
  });

  it("explains that MCP servers are not used while the policy is never", () => {
    mcpMocks.policy = "never";
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
    ];
    render(
      <ToolsContainer localState={stateWith({ mcp: true })} setLocalState={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "MCP Servers settings" }),
    );

    expect(
      document.querySelector('[data-guide="mcp-tool-policy-notice"]'),
    ).toBeInTheDocument();
  });

  it("lists the configured servers by name or address", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
      { id: "l2", url: "http://localhost:9100/mcp" },
    ];
    render(
      <ToolsContainer localState={stateWith({ mcp: true })} setLocalState={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "MCP Servers settings" }),
    );

    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:9100/mcp")).toBeInTheDocument();
  });

  it("selects a server for the chat", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
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

  it("deselects a server for the chat", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
    ];
    const localState = {
      settings: {
        enable_tools: true,
        model: { id: "test-model", name: "Test Model" },
        tools: { mcp: true },
        mcp_local_server_ids: ["l1"],
      },
    };
    const setLocalState = vi.fn((updater) => updater(localState));
    render(<ToolsContainer localState={localState} setLocalState={setLocalState} />);

    fireEvent.click(
      screen.getByRole("button", { name: "MCP Servers settings" }),
    );

    const picker = document.querySelector('[data-guide="mcp-server-picker"]');
    fireEvent.click(picker.querySelector('input[type="checkbox"]'));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.mcp_local_server_ids).toEqual([]);
  });

  it("marks the MCP selector as a data-transfer risk", () => {
    mcpMocks.servers = [
      { id: "l1", name: "Files", url: "http://localhost:9000/mcp" },
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

  it("offers the collection add field in agent mode without turning Arcana on", () => {
    agentMocks.agent = true;
    render(
      <ToolsContainer
        localState={stateWith({ arcana: false })}
        setLocalState={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Arcana settings" }));

    // The chat's own read tools do not need the gateway switch.
    expect(
      screen.getByPlaceholderText("owner/arcana, e.g. alice/papers"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Turn this tool on to configure it."),
    ).not.toBeInTheDocument();
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
    ]) {
      expect(next.settings.tools[key]).toBe(false);
    }
  });
});

describe("ToolsContainer list layout", () => {
  it("puts the two tools with pages last and the chevron after the switch", () => {
    render(<ToolsContainer localState={stateWith({})} setLocalState={vi.fn()} />);

    const rows = [...document.querySelectorAll('[data-guide="tools-grid"] > li')];
    expect(rows.at(-2).textContent).toContain("Arcana");
    expect(rows.at(-1).textContent).toContain("MCP Servers");

    const trail = rows.at(-2).firstElementChild.lastElementChild;
    expect(trail.dataset.testid).toBe("tool-row-trail");
    expect(trail.querySelector("svg.lucide-chevron-right")).toBeTruthy();
    expect(trail.firstElementChild.getAttribute("role")).toBe("switch");
  });

  it("gives every row the same trailing slot, so the switches line up", () => {
    render(<ToolsContainer localState={stateWith({})} setLocalState={vi.fn()} />);

    const rows = [...document.querySelectorAll('[data-guide="tools-grid"] > li')];
    const widthOf = (el) =>
      (el.className.match(/(?:^|\s)(w-[\d.]+)(?:\s|$)/) ?? [])[1];
    const chevronBox =
      rows.at(-2).firstElementChild.lastElementChild.lastElementChild;
    const chevronWidth = widthOf(chevronBox);
    expect(chevronWidth).toBeTruthy();
    for (const row of rows) {
      const trail = row.firstElementChild.lastElementChild;
      expect(trail.dataset.testid).toBe("tool-row-trail");
      // A row without a page keeps an empty box exactly the chevron's size.
      expect(widthOf(trail.lastElementChild)).toBe(chevronWidth);
    }
  });

  it("explains a row's warning on hover", () => {
    render(<ToolsContainer localState={stateWith({})} setLocalState={vi.fn()} />);

    const row = screen.getByRole("button", { name: "Web Search" });
    fireEvent.mouseEnter(row.querySelector("span.cursor-pointer"));

    expect(
      screen.getByText(
        "PRIVACY WARNING: Your chat history may be sent to a search engine (e.g., Google)",
      ),
    ).toBeInTheDocument();
  });

  it("opens the tool page when the arrow itself is clicked", () => {
    render(
      <ToolsContainer
        localState={stateWith({ arcana: true })}
        setLocalState={vi.fn()}
      />,
    );

    const arrow = [
      ...document.querySelectorAll('[data-guide="tools-grid"] svg.lucide-chevron-right'),
    ][0].closest("button");
    fireEvent.click(arrow);

    expect(screen.getByPlaceholderText("Arcana id")).toBeInTheDocument();
  });

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
