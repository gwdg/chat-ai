import { afterEach, describe, expect, it, vi } from "vitest";

const sdkCreate = vi.fn(async () => ({ via: "sdk" }));
const OpenAI = vi.fn(function () {
  this.chat = { completions: { create: sdkCreate } };
});
vi.mock("openai", () => ({ default: OpenAI }));

import { createBackendClient } from "../openaiClient";

describe("createBackendClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses plain fetch by default", async () => {
    vi.stubEnv("VITE_BACKEND_ENDPOINT", "http://backend.test");
    const fetchMock = vi.fn(async () =>
      new Response('{"via":"fetch"}', { headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await createBackendClient().chat.completions.create({});
    expect(res).toEqual({ via: "fetch" });
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it("switches to the openai SDK when VITE_USE_OPENAI_SDK is true", async () => {
    vi.stubEnv("VITE_BACKEND_ENDPOINT", "http://backend.test");
    vi.stubEnv("VITE_USE_OPENAI_SDK", "true");
    const signal = new AbortController().signal;

    const res = await createBackendClient(5000).chat.completions.create({ a: 1 }, { signal });
    expect(res).toEqual({ via: "sdk" });
    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "http://backend.test/", timeout: 5000 })
    );
    expect(sdkCreate).toHaveBeenCalledWith({ a: 1 }, { signal });
  });
});
