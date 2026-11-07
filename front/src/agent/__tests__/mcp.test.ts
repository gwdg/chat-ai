import { describe, expect, it } from "vitest";
import {
  activeMcpServers,
  hasLocalMcpServerValue,
  hasMcpServerValue,
  hasRemoteMcpServerValue,
  isRemoteMcpServer,
  remoteMcpEnabled,
} from "../mcp";

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
