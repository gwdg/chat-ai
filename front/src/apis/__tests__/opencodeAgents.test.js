import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AGENT_SERVICE_CONFLICT_EVENT } from "../agentService";
import {
  AGENT_SERVER_UNAVAILABLE,
  DIRECT_AGENT_BLOCKED,
  getOpencodeInfo,
  isAgentServerUnavailable,
  listOpencodeFiles,
  listOpencodeSessionChildren,
  subscribeOpencodeEvents,
} from "../opencodeAgents";

const access = vi.hoisted(() => ({ direct: true }));

vi.mock("../agentAccess", async (importOriginal) => ({
  ...(await importOriginal()),
  directAgentAccessAllowed: () => access.direct,
}));

const serviceAgent = {
  id: "local-1",
  serviceAgentId: "service-1",
  serverUrl: "/agents/service-1/opencode",
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

describe("opencodeAgents session children", () => {
  const directAgent = { id: "direct", serverUrl: "http://127.0.0.1:9000" };

  it("uses the parent filter that current OpenCode supports", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        data: [
          { id: "child-1", parentID: "parent-1" },
          { id: "child-2", parentID: "parent-1" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetch);

    const children = await listOpencodeSessionChildren(directAgent, "parent-1");

    expect(children.map((child) => child.id)).toEqual(["child-1", "child-2"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      "http://127.0.0.1:9000/api/session?parentID=parent-1&limit=200",
    );
  });

  it("returns no children when the parent has none", async () => {
    const fetch = vi.fn(async () => jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      listOpencodeSessionChildren(directAgent, "parent-1"),
    ).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the children endpoint when the filter is ignored", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "other-root", parentID: null }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "child-1", parentID: "parent-1" }] }),
      );
    vi.stubGlobal("fetch", fetch);

    const children = await listOpencodeSessionChildren(directAgent, "parent-1");

    expect(children.map((child) => child.id)).toEqual(["child-1"]);
    expect(fetch.mock.calls[1][0]).toBe(
      "http://127.0.0.1:9000/api/session/parent-1/children",
    );
  });

  it("falls back when the server rejects the filter", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "bad query" }, 400))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "child-1" }] }));
    vi.stubGlobal("fetch", fetch);

    const children = await listOpencodeSessionChildren(directAgent, "parent-1");

    expect(children.map((child) => child.id)).toEqual(["child-1"]);
    expect(fetch).toHaveBeenCalledTimes(2);
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
    const fetch = vi.fn(async () => jsonResponse({ version: "1" }));
    vi.stubGlobal("fetch", fetch);

    await expect(getOpencodeInfo(serviceAgent)).resolves.toBeDefined();

    // The service path is fixed on the app origin; a stored URL from an older
    // local config cannot point the browser at another host.
    expect(fetch).toHaveBeenCalledWith(
      "/agents/service-1/opencode/api/info",
      expect.anything(),
    );
  });

  it("derives the service path even when the stored URL is a stale host", async () => {
    access.direct = false;
    const fetch = vi.fn(async () => jsonResponse({ version: "1" }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      getOpencodeInfo({
        id: "local-1",
        serviceAgentId: "service-1",
        serverUrl: "http://localhost:8090/agents/service-1/opencode",
      }),
    ).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledWith(
      "/agents/service-1/opencode/api/info",
      expect.anything(),
    );
  });

  it("allows a direct agent when Chat AI runs locally", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ version: "1" })));

    await expect(
      getOpencodeInfo({ id: "direct", serverUrl: "http://127.0.0.1:9000" }),
    ).resolves.toBeDefined();
  });
});

describe("opencodeAgents unavailable server", () => {
  const directAgent = { id: "direct", serverUrl: "http://127.0.0.1:9000" };

  it("reports an HTML answer as unavailable instead of a JSON syntax error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('<!doctype html><html><body>Bad gateway</body></html>', {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    );

    const error = await listOpencodeFiles(directAgent).catch((reason) => reason);

    expect(isAgentServerUnavailable(error)).toBe(true);
    expect(error.message).toBe(AGENT_SERVER_UNAVAILABLE);
    expect(error.message).not.toMatch(/Unexpected token/);
  });

  it("maps a gateway 502 page to unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html><body>Service Unavailable</body></html>", {
            status: 502,
            headers: { "content-type": "text/html" },
          }),
      ),
    );

    await expect(listOpencodeFiles(directAgent)).rejects.toMatchObject({
      code: "AGENT_SERVER_UNAVAILABLE",
    });
  });

  it("maps a network failure to unavailable but leaves aborts alone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(listOpencodeFiles(directAgent)).rejects.toMatchObject({
      code: "AGENT_SERVER_UNAVAILABLE",
    });

    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw abort;
      }),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      subscribeOpencodeEvents(directAgent, () => {}, controller.signal),
    ).rejects.toBe(abort);
  });

  it("still returns the file list from a JSON answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ data: [{ path: "hello.py" }] })),
    );

    await expect(listOpencodeFiles(directAgent)).resolves.toEqual([
      { path: "hello.py" },
    ]);
    expect(isAgentServerUnavailable(new Error("other"))).toBe(false);
  });
});
