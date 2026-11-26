import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isSaiaFsAvailable,
  saiaFsBaseUrl,
  saiaFsHealthUrl,
  saiaFsMcpUrl,
} from "../saiaFs";

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_ENDPOINT", "http://localhost:8081/");
  vi.stubEnv("VITE_API_KEY", "");
  vi.stubEnv("VITE_FAKE_AUTH_HEADERS", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("saia-fs URLs", () => {
  it("builds every route from the backend endpoint, with no extra setting", () => {
    expect(saiaFsBaseUrl()).toBe("http://localhost:8081/mcp/saia-fs");
    expect(saiaFsMcpUrl()).toBe("http://localhost:8081/mcp/saia-fs/mcp");
    expect(saiaFsHealthUrl()).toBe("http://localhost:8081/mcp/saia-fs/health");
  });

  it("resolves a relative backend path against the page origin", () => {
    vi.stubEnv("VITE_BACKEND_ENDPOINT", "/backend");

    expect(saiaFsBaseUrl()).toBe("http://localhost/backend/mcp/saia-fs");
  });
});

describe("isSaiaFsAvailable", () => {
  it("probes the health route with the caller's auth headers", async () => {
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "alive" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(isSaiaFsAvailable()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8081/mcp/saia-fs/health",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer local-dev-key" },
        cache: "no-store",
      }),
    );
  });

  it("requires the registry's alive answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "starting" }), { status: 200 }),
      ),
    );

    await expect(isSaiaFsAvailable()).resolves.toBe(false);
  });

  it("treats a non-JSON answer as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>gateway</html>", { status: 200 })),
    );

    await expect(isSaiaFsAvailable()).resolves.toBe(false);
  });

  it("treats 503 (no instance) as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "No instance available" }), {
          status: 503,
        }),
      ),
    );

    await expect(isSaiaFsAvailable()).resolves.toBe(false);
  });

  it("treats 404 (no route) as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    await expect(isSaiaFsAvailable()).resolves.toBe(false);
  });

  it("treats a refused request as unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(isSaiaFsAvailable()).resolves.toBe(false);
  });

  it("gives up on a hanging instance after the timeout", async () => {
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

    const pending = isSaiaFsAvailable({ timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toBe(false);
  });

  it("answers unavailable when the caller aborts", async () => {
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
    const controller = new AbortController();

    const pending = isSaiaFsAvailable({ signal: controller.signal });
    controller.abort();

    await expect(pending).resolves.toBe(false);
  });
});
