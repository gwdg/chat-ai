import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentApiKey,
  agentRequestHeaders,
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

  it("honours the external flag of the extended models response", () => {
    expect(
      modelSupportsTools({ id: "openai-gpt5", name: "OpenAI GPT-5", external: true }),
    ).toBe(false);
    expect(
      modelSupportsTools({ id: "openai-gpt5", name: "OpenAI GPT-5", external: false }),
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
