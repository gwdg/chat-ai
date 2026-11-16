import { afterEach, describe, expect, it, vi } from "vitest";
import { agentApiKey, agentRequestHeaders } from "../agentEndpoints";

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
