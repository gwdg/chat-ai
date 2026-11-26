import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isSaiaRagAvailable, saiaRagBaseUrl, saiaRagHealthUrl, saiaRagMcpUrl } from "../saiaRag";

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_ENDPOINT", "http://localhost:10000/public/v1/");
  vi.stubEnv("VITE_API_KEY", "");
  vi.stubEnv("VITE_FAKE_AUTH_HEADERS", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("saia-rag URLs", () => {
  it("builds every route from the backend endpoint, with no extra setting", () => {
    expect(saiaRagBaseUrl()).toBe("http://localhost:10000/public/v1/mcp/saia-rag");
    expect(saiaRagMcpUrl()).toBe("http://localhost:10000/public/v1/mcp/saia-rag/mcp");
    expect(saiaRagHealthUrl()).toBe("http://localhost:10000/public/v1/mcp/saia-rag/health");
  });

  it("resolves a relative backend path against the page origin", () => {
    vi.stubEnv("VITE_BACKEND_ENDPOINT", "/backend");

    expect(saiaRagBaseUrl()).toBe("http://localhost/backend/mcp/saia-rag");
  });
});

describe("isSaiaRagAvailable", () => {
  it("probes the engine's health route with the caller's identity", async () => {
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    vi.stubEnv("VITE_FAKE_AUTH_HEADERS", JSON.stringify({ "x-auth-claim-uid": "alice" }));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "alive" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(isSaiaRagAvailable()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:10000/public/v1/mcp/saia-rag/health",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer local-dev-key", "x-auth-claim-uid": "alice" },
        cache: "no-store",
      }),
    );
  });

  it("requires the service's alive answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "starting" }), { status: 200 })),
    );

    await expect(isSaiaRagAvailable()).resolves.toBe(false);
  });

  it("treats a non-JSON answer as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>gateway</html>", { status: 200 })),
    );

    await expect(isSaiaRagAvailable()).resolves.toBe(false);
  });

  it("treats 404 (no route in front of the engine) as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(isSaiaRagAvailable()).resolves.toBe(false);
  });

  it("treats 503 (no registered instance) as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "No instance available for service 'saia-rag'." }), {
          status: 503,
        }),
      ),
    );

    await expect(isSaiaRagAvailable()).resolves.toBe(false);
  });

  it("treats a refused request as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(isSaiaRagAvailable()).resolves.toBe(false);
  });

  it("gives up on a hanging engine after the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const pending = isSaiaRagAvailable({ timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toBe(false);
  });
});
