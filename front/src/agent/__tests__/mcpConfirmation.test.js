import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginMcpConfirmationSession,
  getMcpConfirmation,
  isMcpConfirmationAlwaysAllowed,
  requestMcpConfirmation,
  resetMcpConfirmationSession,
  resolveMcpConfirmation,
  subscribeMcpConfirmations,
} from "../mcpConfirmation";

describe("MCP confirmations", () => {
  beforeEach(() => {
    resetMcpConfirmationSession();
  });

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

  it("always allows the same server and tool for the rest of the turn", async () => {
    const first = requestMcpConfirmation({
      id: "call-4",
      server: "http://localhost:9000",
      tool: "read_file",
      args: { path: "/a" },
    });
    resolveMcpConfirmation("call-4", true, true);
    await expect(first).resolves.toBe(true);

    await expect(
      requestMcpConfirmation({
        id: "call-5",
        server: "http://localhost:9000",
        tool: "read_file",
        args: { path: "/b" },
      }),
    ).resolves.toBe(true);
    expect(getMcpConfirmation("call-5")).toBeUndefined();
  });

  it("does not cover another tool or another server", async () => {
    const first = requestMcpConfirmation({
      id: "call-6",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    resolveMcpConfirmation("call-6", true, true);
    await first;

    const otherTool = requestMcpConfirmation({
      id: "call-7",
      server: "http://localhost:9000",
      tool: "write_file",
      args: {},
    });
    const otherServer = requestMcpConfirmation({
      id: "call-8",
      server: "http://localhost:9001",
      tool: "read_file",
      args: {},
    });
    expect(getMcpConfirmation("call-7")).toBeDefined();
    expect(getMcpConfirmation("call-8")).toBeDefined();
    resolveMcpConfirmation("call-7", false);
    resolveMcpConfirmation("call-8", false);
    await expect(otherTool).resolves.toBe(false);
    await expect(otherServer).resolves.toBe(false);
  });

  it("settles matching calls that are already waiting", async () => {
    const first = requestMcpConfirmation({
      id: "call-9",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    const second = requestMcpConfirmation({
      id: "call-10",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });

    resolveMcpConfirmation("call-9", true, true);

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it("forgets always grants when the session is reset", async () => {
    const first = requestMcpConfirmation({
      id: "call-11",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    resolveMcpConfirmation("call-11", true, true);
    await first;

    resetMcpConfirmationSession();

    const again = requestMcpConfirmation({
      id: "call-12",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    expect(getMcpConfirmation("call-12")).toBeDefined();
    resolveMcpConfirmation("call-12", false);
    await expect(again).resolves.toBe(false);
  });

  it("marks the model-facing call name of an always grant", async () => {
    const first = requestMcpConfirmation({
      id: "call-18",
      server: "http://localhost:9000",
      tool: "read_file",
      callName: "folder__read_file",
      args: {},
    });
    resolveMcpConfirmation("call-18", true, true);
    await first;

    expect(isMcpConfirmationAlwaysAllowed("folder__read_file")).toBe(true);
    expect(isMcpConfirmationAlwaysAllowed("folder__write_file")).toBe(false);

    resetMcpConfirmationSession();
    expect(isMcpConfirmationAlwaysAllowed("folder__read_file")).toBe(false);
  });

  it("keeps always grants across turns of the same conversation", async () => {
    beginMcpConfirmationSession("chat-a");
    const first = requestMcpConfirmation({
      id: "call-13",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    resolveMcpConfirmation("call-13", true, true);
    await first;

    beginMcpConfirmationSession("chat-a");
    await expect(
      requestMcpConfirmation({
        id: "call-14",
        server: "http://localhost:9000",
        tool: "read_file",
        args: {},
      }),
    ).resolves.toBe(true);
  });

  it("forgets always grants when another conversation starts", async () => {
    beginMcpConfirmationSession("chat-a");
    const first = requestMcpConfirmation({
      id: "call-15",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    resolveMcpConfirmation("call-15", true, true);
    await first;

    beginMcpConfirmationSession("chat-b");
    const again = requestMcpConfirmation({
      id: "call-16",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    expect(getMcpConfirmation("call-16")).toBeDefined();
    resolveMcpConfirmation("call-16", false);
    await expect(again).resolves.toBe(false);

    beginMcpConfirmationSession("chat-a");
    const back = requestMcpConfirmation({
      id: "call-17",
      server: "http://localhost:9000",
      tool: "read_file",
      args: {},
    });
    expect(getMcpConfirmation("call-17")).toBeDefined();
    resolveMcpConfirmation("call-17", false);
    await expect(back).resolves.toBe(false);
  });
});
