import { afterEach, describe, expect, it, vi } from "vitest";
import { getModelsData } from "../getModelsData";

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("getModelsData", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends the configured apiKey when fetching models", async () => {
    vi.stubEnv("VITE_MODELS_ENDPOINT", "http://engine.test/v1/models");
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: [{ id: "bridge/local-echo-1" }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    const models = await getModelsData();

    expect(fetchMock).toHaveBeenCalledWith("http://engine.test/v1/models", {
      headers: { Authorization: "Bearer local-dev-key" },
    });
    expect(models).toEqual([{ id: "bridge/local-echo-1", name: "bridge/local-echo-1" }]);
  });

  it("sends no Authorization header without an apiKey", async () => {
    vi.stubEnv("VITE_MODELS_ENDPOINT", "http://backend.test/models");
    vi.stubEnv("VITE_API_KEY", "");
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getModelsData();

    expect(fetchMock.mock.calls[0][1]).toEqual({ headers: {} });
  });
});
