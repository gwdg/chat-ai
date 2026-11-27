import { afterEach, describe, expect, it, vi } from "vitest";

// The E2EE wrapper only rewrites keyed /chat/completions calls; keep this test on plain fetch.
vi.mock("../../e2ee/fetch", () => ({
  e2eeFetch: (input: RequestInfo, init?: RequestInit) =>
    (globalThis.fetch as typeof fetch)(input, init),
}));

import {
  agentApiKey,
  agentRequestHeaders,
  convertDocument,
  generateSpeech,
  markToolless,
  modelSupportsTools,
} from "../agentEndpoints";

describe("agent upstream auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the placeholder key that the back service ignores", () => {
    vi.stubEnv("VITE_API_KEY", "");
    expect(agentApiKey()).toBe("set-by-backend");
    expect(agentRequestHeaders()).toEqual({});
  });

  it("uses the configured key for a direct endpoint", () => {
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    expect(agentApiKey()).toBe("local-dev-key");
    expect(agentRequestHeaders()).toEqual({ Authorization: "Bearer local-dev-key" });
  });
});

describe("modelSupportsTools", () => {
  it("keeps tools for a bridge model whose name carries the external marker", () => {
    // Bridge models are marked "(External)" for the engine's demand updater, but the engine
    // keeps their tools in the request body (saia-engine is_external_service()).
    expect(
      modelSupportsTools({
        id: "bridge/local-echo-1",
        name: "local-echo-1 (local mock) (External)",
      }),
    ).toBe(true);
  });

  it("does not treat the external flag as a capability claim", () => {
    // `external` is the data-safety label from /models. A bridge model is external there and
    // still keeps its tools (saia-engine keeps them in the request body), so only data may
    // take tools away: a model config, or a rejection learned at runtime.
    expect(
      modelSupportsTools({ id: "openai-gpt5", name: "OpenAI GPT-5", external: true }),
    ).toBe(true);
    expect(
      modelSupportsTools({ id: "openai-gpt5", name: "OpenAI GPT-5 (External)", external: true }),
    ).toBe(true);
  });

  it("honours an explicit tools:false in the model config", () => {
    expect(
      modelSupportsTools({ id: "qwen3-omni-30b-a3b-instruct", name: "Qwen 3 Omni" }),
    ).toBe(false);
  });

  it("remembers a model that rejected tools at runtime", () => {
    markToolless("bridge/local-echo-toolless");
    expect(
      modelSupportsTools({
        id: "bridge/local-echo-toolless",
        name: "local-echo-toolless (External)",
      }),
    ).toBe(false);
  });
});

describe("media and document failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const respond = (status: number, body: string) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status })),
    );
  };

  it("names the upstream service behind the engine's opaque 404", async () => {
    // saia-engine answers /audio/speech with the registry's bare error; the route name is the
    // only thing that tells which service has to be registered.
    respond(404, '{"detail":"Unknown model/service"}');

    await expect(generateSpeech("hello")).rejects.toThrow(
      /has no "kokoro-82m" service \(or no instance of it\), so \/audio\/speech never reached one/,
    );
  });

  it("uses the service named in the engine's error body", async () => {
    respond(
      404,
      '{"error":{"message":"No instance available for service \'saia-agent\'. Try again later."}}',
    );

    await expect(convertDocument(new Uint8Array(), "a.pdf")).rejects.toThrow(
      /has no "saia-agent" service/,
    );
  });

  it("keeps the plain failure text for an unrelated error", async () => {
    respond(500, "upstream exploded");

    await expect(generateSpeech("hello")).rejects.toThrow(
      /^\/audio\/speech failed: 500 upstream exploded$/,
    );
  });
});
