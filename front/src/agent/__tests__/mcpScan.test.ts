import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_MCP_SCAN_FIRST_PORT,
  LOCAL_MCP_SCAN_LAST_PORT,
  isMcpEndpointResponse,
  scanLocalMcpServers,
} from "../mcpScan";

describe("scanLocalMcpServers", () => {
  it("starts above port 5000", () => {
    expect(LOCAL_MCP_SCAN_FIRST_PORT).toBe(5001);
    expect(LOCAL_MCP_SCAN_LAST_PORT).toBe(65535);
  });

  it("returns the reachable ports as URLs, sorted", async () => {
    const found = await scanLocalMcpServers({
      firstPort: 5001,
      lastPort: 5010,
      concurrency: 3,
      probe: async (port) => port === 5007 || port === 5002,
    });

    expect(found).toEqual([
      { port: 5002, url: "http://localhost:5002/mcp" },
      { port: 5007, url: "http://localhost:5007/mcp" },
    ]);
  });

  it("probes only the configured range and reports progress", async () => {
    const probed: number[] = [];
    const progress: { scanned: number; total: number; found: number }[] = [];

    const found = await scanLocalMcpServers({
      firstPort: 6000,
      lastPort: 6004,
      concurrency: 2,
      onProgress: (value) => progress.push(value),
      probe: async (port) => {
        probed.push(port);
        return port === 6003;
      },
    });

    expect(probed.sort()).toEqual([6000, 6001, 6002, 6003, 6004]);
    expect(found).toEqual([{ port: 6003, url: "http://localhost:6003/mcp" }]);
    expect(progress[progress.length - 1]).toEqual({
      scanned: 5,
      total: 5,
      found: 1,
    });
  });

  it("reports every hit while it is found", async () => {
    const found: { port: number; url: string }[] = [];
    await scanLocalMcpServers({
      firstPort: 5001,
      lastPort: 5003,
      onFound: (server) => found.push(server),
      probe: async (port) => port === 5003,
    });

    expect(found).toEqual([{ port: 5003, url: "http://localhost:5003/mcp" }]);
  });

  it("never runs more probes at once than the concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    let release: () => void = () => {};
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });

    const run = scanLocalMcpServers({
      firstPort: 1,
      lastPort: 50,
      concurrency: 5,
      probe: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await barrier;
        active -= 1;
        return false;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(maxActive).toBe(5);
    release();
    await run;
  });

  it("stops on abort and keeps what was found", async () => {
    const controller = new AbortController();
    const found = await scanLocalMcpServers({
      firstPort: 5001,
      lastPort: 5100,
      concurrency: 2,
      signal: controller.signal,
      probe: async (port) => {
        if (port === 5002) controller.abort();
        return port === 5001;
      },
    });

    expect(found).toEqual([{ port: 5001, url: "http://localhost:5001/mcp" }]);
  });

  it("does not probe at all when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const probe = vi.fn(async () => true);

    const found = await scanLocalMcpServers({
      firstPort: 5001,
      lastPort: 5010,
      signal: controller.signal,
      probe,
    });

    expect(found).toEqual([]);
    expect(probe).not.toHaveBeenCalled();
  });
});

describe("isMcpEndpointResponse", () => {
  const response = (status: number, headers: Record<string, string> = {}) =>
    new Response(null, { status, headers });

  it("accepts MCP answers", () => {
    expect(
      isMcpEndpointResponse(response(405, { "content-type": "application/json" })),
    ).toBe(true);
    expect(
      isMcpEndpointResponse(response(200, { "content-type": "text/event-stream" })),
    ).toBe(true);
    expect(
      isMcpEndpointResponse(response(200, { "content-type": "application/json" })),
    ).toBe(true);
    expect(isMcpEndpointResponse(response(401))).toBe(true);
    expect(
      isMcpEndpointResponse(response(200, { "mcp-session-id": "abc" })),
    ).toBe(true);
  });

  it("rejects other endpoints on the same port", () => {
    expect(isMcpEndpointResponse(response(404))).toBe(false);
    expect(
      isMcpEndpointResponse(response(200, { "content-type": "text/html" })),
    ).toBe(false);
    expect(isMcpEndpointResponse(response(503))).toBe(false);
  });
});
