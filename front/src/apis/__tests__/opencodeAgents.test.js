import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AGENT_SERVICE_CONFLICT_EVENT } from "../agentService";
import { DIRECT_AGENT_BLOCKED, getOpencodeInfo } from "../opencodeAgents";

const access = vi.hoisted(() => ({ direct: true }));

vi.mock("../agentAccess", async (importOriginal) => ({
  ...(await importOriginal()),
  directAgentAccessAllowed: () => access.direct,
}));

const serviceAgent = {
  id: "local-1",
  serviceAgentId: "service-1",
  serverUrl: "http://agent-service:8090/agents/service-1/opencode",
};

const serviceConflict = {
  detail: "agent service-1 is failed, not running",
  code: "conflict",
  agent_id: "service-1",
  status: "failed",
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const conflicts = [];
const collect = (event) => conflicts.push(event.detail);

beforeEach(() => {
  conflicts.length = 0;
  access.direct = true;
  window.addEventListener(AGENT_SERVICE_CONFLICT_EVENT, collect);
});

afterEach(() => {
  window.removeEventListener(AGENT_SERVICE_CONFLICT_EVENT, collect);
  vi.unstubAllGlobals();
});

describe("opencodeAgents conflict reporting", () => {
  it("reports a service conflict so the agent can be dropped", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(serviceConflict, 409)),
    );

    await expect(getOpencodeInfo(serviceAgent)).rejects.toThrow(/409/);

    expect(conflicts).toEqual([
      expect.objectContaining({
        serviceAgentId: "service-1",
        agentId: "local-1",
        code: "conflict",
        status: "failed",
      }),
    ]);
  });

  it("ignores a 409 from a directly connected agent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(serviceConflict, 409)),
    );

    await expect(
      getOpencodeInfo({ id: "direct", serverUrl: "http://127.0.0.1:9000" }),
    ).rejects.toThrow(/409/);

    expect(conflicts).toEqual([]);
  });

  it("ignores a proxied OpenCode 409 that is not the service's own", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "session is busy" }, 409)),
    );

    await expect(getOpencodeInfo(serviceAgent)).rejects.toThrow(/409/);

    expect(conflicts).toEqual([]);
  });

  it("still reports other errors unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "boom" }, 500)),
    );

    await expect(getOpencodeInfo(serviceAgent)).rejects.toThrow(
      /opencode server responded with 500/,
    );
    expect(conflicts).toEqual([]);
  });
});

describe("opencodeAgents direct access guard", () => {
  it("blocks a direct agent outside local access without calling it", async () => {
    access.direct = false;
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      getOpencodeInfo({ id: "direct", serverUrl: "http://127.0.0.1:9000" }),
    ).rejects.toThrow(DIRECT_AGENT_BLOCKED);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still reaches a service-managed agent outside local access", async () => {
    access.direct = false;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ version: "1" })));

    await expect(getOpencodeInfo(serviceAgent)).resolves.toBeDefined();
  });

  it("allows a direct agent when Chat AI runs locally", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ version: "1" })));

    await expect(
      getOpencodeInfo({ id: "direct", serverUrl: "http://127.0.0.1:9000" }),
    ).resolves.toBeDefined();
  });
});
