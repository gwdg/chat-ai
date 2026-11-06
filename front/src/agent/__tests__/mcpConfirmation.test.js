import { describe, expect, it, vi } from "vitest";
import {
  getMcpConfirmation,
  requestMcpConfirmation,
  resolveMcpConfirmation,
  subscribeMcpConfirmations,
} from "../mcpConfirmation";

describe("MCP confirmations", () => {
  it("waits for an explicit decision", async () => {
    const pending = requestMcpConfirmation({
      id: "call-1",
      server: "http://localhost:9000",
      tool: "read_file",
      args: { path: "/a" },
    });
    expect(getMcpConfirmation("call-1")).toMatchObject({ tool: "read_file" });

    resolveMcpConfirmation("call-1", true);
    await expect(pending).resolves.toBe(true);
    expect(getMcpConfirmation("call-1")).toBeUndefined();
  });

  it("notifies subscribers", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMcpConfirmations(listener);
    const pending = requestMcpConfirmation({
      id: "call-2",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    expect(listener).toHaveBeenCalled();
    resolveMcpConfirmation("call-2", false);
    await expect(pending).resolves.toBe(false);
    unsubscribe();
  });

  it("denies a call when the turn is aborted", async () => {
    const controller = new AbortController();
    const pending = requestMcpConfirmation(
      {
        id: "call-3",
        server: "http://localhost:9000",
        tool: "read_file",
        args: {},
      },
      controller.signal,
    );
    controller.abort();
    await expect(pending).resolves.toBe(false);
    expect(getMcpConfirmation("call-3")).toBeUndefined();
  });
});
