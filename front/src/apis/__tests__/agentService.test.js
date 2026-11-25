import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceAgent,
  deleteServiceAgent,
  serviceOpencodeUrl,
} from "../agentService";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("agentService", () => {
  it("addresses the service on the app origin, so no service URL is needed", () => {
    expect(serviceOpencodeUrl("abc")).toBe("/agents/abc/opencode");
    expect(serviceOpencodeUrl("a/b")).toBe("/agents/a%2Fb/opencode");
  });

  it("creates an agent and returns the OpenCode proxy URL", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        id: "agent-1",
        status: "running",
        port: 9100,
        base_url: "http://127.0.0.1:9100",
      }),
    );
    vi.stubGlobal("fetch", fetch);

    const created = await createServiceAgent({ name: "Research" });

    expect(fetch).toHaveBeenCalledWith(
      "/agents",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      name: "Research",
    });
    expect(created).toEqual({
      serviceAgentId: "agent-1",
      serverUrl: "/agents/agent-1/opencode",
      serviceStatus: "running",
    });
  });

  it("reports why the service could not start the agent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          id: "agent-1",
          status: "failed",
          last_error: "docker: command not found",
        }),
      ),
    );

    await expect(createServiceAgent()).rejects.toThrow("docker: command not found");
  });

  it("deletes the agent and treats an already-missing one as deleted", async () => {
    const fetch = vi.fn(async () => jsonResponse({ deleted: true }));
    vi.stubGlobal("fetch", fetch);
    await deleteServiceAgent("agent-1");
    expect(fetch).toHaveBeenCalledWith(
      "/agents/agent-1",
      expect.objectContaining({ method: "DELETE" }),
    );

    fetch.mockResolvedValueOnce(
      jsonResponse({ detail: "no such agent" }, 404),
    );
    await expect(deleteServiceAgent("gone")).resolves.toBeUndefined();
  });

  it("surfaces a real deletion failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "backend unavailable" }, 502)),
    );
    await expect(deleteServiceAgent("agent-1")).rejects.toThrow(
      /502.*backend unavailable/,
    );
  });
});
