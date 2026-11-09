import { describe, expect, it, vi } from "vitest";
import {
  activeMcpServers,
  connectMcpServers,
  hasLocalMcpServerValue,
  hasMcpServerValue,
  hasRemoteMcpServerValue,
  isRemoteMcpServer,
  remoteMcpEnabled,
} from "../mcp";

const sdk = vi.hoisted(() => ({ names: new Map<string, string>() }));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    name = "";
    async connect(transport: { url: string }) {
      this.name = sdk.names.get(transport.url) ?? "server";
    }
    getServerVersion() {
      return { name: this.name };
    }
    async listTools() {
      return {
        tools: [{ name: "echo", inputSchema: { type: "object", properties: {} } }],
      };
    }
    async close() {}
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    url: string;
    constructor(url: URL) {
      this.url = String(url);
    }
  },
}));

const local = { url: "http://localhost:9000/mcp", enabled: true };
const remote = { id: "server-1", enabled: true };

describe("MCP server entries", () => {
  it("separates local URLs from remote gateway ids", () => {
    expect(isRemoteMcpServer(remote)).toBe(true);
    expect(isRemoteMcpServer(local)).toBe(false);
    expect(hasRemoteMcpServerValue([remote, local])).toBe(true);
    expect(hasLocalMcpServerValue([remote, local])).toBe(true);
    expect(hasRemoteMcpServerValue([local])).toBe(false);
    expect(hasLocalMcpServerValue([remote])).toBe(false);
    expect(hasMcpServerValue([remote, local])).toBe(true);
  });

  it("keeps the enable flags separate", () => {
    expect(remoteMcpEnabled({ tools: { mcp_remote: true } })).toBe(true);
    expect(remoteMcpEnabled({ tools: { mcp_remote: false, mcp: true } })).toBe(false);
    expect(remoteMcpEnabled({ tools: { mcp: true }, mcp_servers: [remote] })).toBe(true);
  });

  it("does not treat a local server as a remote gateway server", () => {
    expect(remoteMcpEnabled({ tools: { mcp: true }, mcp_servers: [local] })).toBe(false);
  });

  it("activates only local URL servers for the agent", () => {
    expect(
      activeMcpServers({
        tools: { mcp: true, mcp_remote: true },
        mcp_servers: [remote, local],
      }),
    ).toEqual([local]);
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
