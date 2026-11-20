import { describe, expect, it, vi } from "vitest";
import {
  activeMcpServers,
  connectMcpServers,
  describeMcpServer,
  getMcpServerStatus,
  hasLocalMcpServerValue,
  hasMcpServerValue,
  normalizeMcpUrl,
  resolveMcpServers,
  testMcpServer,
} from "../mcp";

const sdk = vi.hoisted(() => ({
  names: new Map<string, string>(),
  failing: new Set<string>(),
  fetchFailures: new Set<string>(),
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    name = "";
    transport?: { url: string; protocolVersion?: string };
    async connect(transport: { url: string; protocolVersion?: string }) {
      if (sdk.failing.has(transport.url)) throw new Error("unreachable");
      // What the browser throws for a refused connection, a rejected CORS preflight
      // and a mixed-content block alike.
      if (sdk.fetchFailures.has(transport.url)) throw new TypeError("Failed to fetch");
      this.transport = transport;
      this.name = sdk.names.get(transport.url) ?? "server";
    }
    getServerVersion() {
      return {
        name: this.name,
        title: `${this.name} title`,
        version: "1.2.3",
        description: `${this.name} description`,
        websiteUrl: "https://example.test/server",
      };
    }
    getServerCapabilities() {
      return { tools: { listChanged: true }, resources: {} };
    }
    getInstructions() {
      return "Use the echo tool.";
    }
    async listTools() {
      return {
        tools: [
          {
            name: "echo",
            title: "Echo",
            description: "Returns its input.",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      };
    }
    async close() {}
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    url: string;
    protocolVersion = "2025-06-18";
    constructor(url: URL) {
      this.url = String(url);
    }
  },
}));

const local = { url: "http://localhost:9000/mcp", enabled: true };

describe("MCP server entries", () => {
  it("recognises a server by its URL, not by a gateway id", () => {
    expect(hasLocalMcpServerValue([local])).toBe(true);
    expect(hasLocalMcpServerValue([{ id: "gateway-id" }])).toBe(false);
    expect(hasMcpServerValue([local])).toBe(true);
    expect(hasMcpServerValue([{ id: "gateway-id" }])).toBe(false);
  });

  it("resolves globally configured selections for a chat", () => {
    const globals = [
      { id: "g-files", name: "Files", url: "http://localhost:9000/mcp" },
      { id: "g-notes", name: "Notes", url: "http://localhost:9100/mcp" },
    ];
    const resolved = resolveMcpServers(
      { mcp_local_server_ids: ["g-files", "g-notes"] },
      globals,
    );
    expect(resolved).toEqual([
      expect.objectContaining({ url: "http://localhost:9000/mcp" }),
      expect.objectContaining({ url: "http://localhost:9100/mcp", name: "Notes" }),
    ]);
  });

  it("uses the global address instead of a legacy per-chat entry", () => {
    const resolved = resolveMcpServers(
      {
        mcp_servers: [{ url: "http://old-host:9000/mcp", enabled: true }],
        mcp_local_server_ids: ["g-local"],
      },
      [
        {
          id: "g-local",
          name: "Files",
          url: "http://new-host:9000/mcp",
        },
      ],
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toEqual(
      expect.objectContaining({ url: "http://new-host:9000/mcp" }),
    );
  });

  it("drops the same address when it is selected twice", () => {
    const resolved = resolveMcpServers(
      {
        mcp_servers: [{ url: "localhost:9000/mcp", enabled: true }],
        mcp_local_server_ids: ["g-local"],
      },
      [{ id: "g-local", url: "http://localhost:9000/mcp" }],
    );
    expect(resolved).toHaveLength(1);
  });

  it("activates only URL servers for the agent", () => {
    expect(
      activeMcpServers({
        tools: { mcp: true },
        mcp_servers: [{ id: "gateway-id", enabled: true }, local],
      }),
    ).toEqual([local]);
  });

  it("skips a server whose stored address is not a URL", () => {
    expect(
      activeMcpServers({
        tools: { mcp: true },
        mcp_servers: [
          { url: "julian_kunkel", enabled: true },
          { url: "https://julian_kunkel/", enabled: true },
          local,
        ],
      }),
    ).toEqual([local]);
  });
});

describe("MCP URL normalization", () => {
  it("adds a scheme to bare local addresses", () => {
    expect(normalizeMcpUrl("localhost:9000/mcp")).toBe(
      "http://localhost:9000/mcp",
    );
    expect(normalizeMcpUrl("127.0.0.1:9000")).toBe("http://127.0.0.1:9000/");
  });

  it("defaults other bare hosts to https", () => {
    expect(normalizeMcpUrl("example.com/mcp")).toBe(
      "https://example.com/mcp",
    );
  });

  it("rejects names that are not valid host names", () => {
    expect(normalizeMcpUrl("julian_kunkel")).toBe("");
    expect(normalizeMcpUrl("https://julian_kunkel/")).toBe("");
    expect(normalizeMcpUrl("https://foo_bar.example.com/")).toBe("");
  });

  it("rejects unsupported protocols", () => {
    expect(normalizeMcpUrl("ftp://example.com")).toBe("");
  });
});

describe("MCP server name changes", () => {
  it("asks when the reported name differs and accepts the new name", async () => {
    sdk.names.set("http://name-a.test/mcp", "New Name");
    const onNameMismatch = vi.fn(async () => true);

    const { tools } = await connectMcpServers(
      [{ url: "http://name-a.test/mcp", enabled: true, name: "Old Name" }],
      new Set(),
      { onNameMismatch },
    );

    expect(onNameMismatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Old Name" }),
      "New Name",
    );
    expect(tools.map((tool) => tool.name)).toEqual([
      expect.stringMatching(/^New_Name__echo/),
    ]);
  });

  it("skips the server when the user declines the name change", async () => {
    sdk.names.set("http://name-b.test/mcp", "New Name");
    const onNameMismatch = vi.fn(async () => false);

    const { tools } = await connectMcpServers(
      [{ url: "http://name-b.test/mcp", enabled: true, name: "Old Name" }],
      new Set(),
      { onNameMismatch },
    );

    expect(onNameMismatch).toHaveBeenCalledTimes(1);
    expect(tools).toHaveLength(0);
  });

  it("does not ask when the name matches or was never saved", async () => {
    sdk.names.set("http://name-c.test/mcp", "Same Name");
    sdk.names.set("http://name-d.test/mcp", "Any Name");
    const onNameMismatch = vi.fn(async () => false);

    const { tools } = await connectMcpServers(
      [
        { url: "http://name-c.test/mcp", enabled: true, name: "Same Name" },
        { url: "http://name-d.test/mcp", enabled: true },
      ],
      new Set(),
      { onNameMismatch },
    );

    expect(onNameMismatch).not.toHaveBeenCalled();
    expect(tools).toHaveLength(2);
  });
});

describe("MCP connections use the URL the settings test uses", () => {
  it("adds the scheme a stored url left out", async () => {
    sdk.names.set("http://localhost:9000/mcp", "Bare Url Server");

    // The settings keep what the user typed; `new URL("localhost:9000/mcp")` would read
    // `localhost:` as the scheme, so the bridge failed where the test button succeeded.
    const result = await testMcpServer({ url: "localhost:9000/mcp", enabled: true });

    expect(result.name).toBe("Bare Url Server");
    expect(getMcpServerStatus("http://localhost:9000/mcp")).toBe("ready");
  });

  it("names the address and the causes when the browser blocks the request", async () => {
    sdk.fetchFailures.add("http://blocked.test/mcp");

    // A tool result reaches the model and the chat, so the bare browser wording is not
    // enough to act on: the url, CORS and mixed content all have to be in the message.
    await expect(
      testMcpServer({ url: "http://blocked.test/mcp", enabled: true }),
    ).rejects.toThrow(
      /Could not reach the MCP server at http:\/\/blocked\.test\/mcp.*CORS/,
    );
    expect(getMcpServerStatus("http://blocked.test/mcp")).toBe("error");
  });
});

describe("MCP server status", () => {
  it("records a working server and announces it, so a light can turn green", async () => {
    const events: Array<{ url?: string; status?: string }> = [];
    const onStatus = (event: Event) =>
      events.push((event as CustomEvent).detail);
    window.addEventListener("chatai:mcp-status", onStatus);

    await testMcpServer({ url: "http://status-ok.test/mcp", enabled: true });

    window.removeEventListener("chatai:mcp-status", onStatus);
    expect(getMcpServerStatus("http://status-ok.test/mcp")).toBe("ready");
    expect(events).toContainEqual({
      url: "http://status-ok.test/mcp",
      status: "ready",
    });
  });

  it("records a server that cannot be reached as an error", async () => {
    sdk.failing.add("http://status-bad.test/mcp");

    await expect(
      testMcpServer({ url: "http://status-bad.test/mcp", enabled: true }),
    ).rejects.toThrow("unreachable");

    expect(getMcpServerStatus("http://status-bad.test/mcp")).toBe("error");
    expect(getMcpServerStatus("http://status-unknown.test/mcp")).toBeUndefined();
  });
});

describe("MCP server details", () => {
  it("reports the implementation, protocol version, capabilities and tools", async () => {
    const details = await describeMcpServer({
      url: "http://details.test/mcp",
      enabled: true,
    });

    expect(details).toMatchObject({
      name: "server",
      title: "server title",
      version: "1.2.3",
      description: "server description",
      websiteUrl: "https://example.test/server",
      protocolVersion: "2025-06-18",
      instructions: "Use the echo tool.",
    });
    expect(details.capabilities).toContainEqual({
      name: "tools",
      detail: "listChanged",
    });
    expect(details.capabilities).toContainEqual({
      name: "resources",
      detail: undefined,
    });
    expect(details.tools).toEqual([
      { name: "echo", title: "Echo", description: "Returns its input." },
    ]);
  });
});
