import { afterEach, describe, expect, it, vi } from "vitest";
import { authHeaders, getApiKey } from "../authHeaders";

describe("authHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends nothing when no apiKey is configured", () => {
    vi.stubEnv("VITE_API_KEY", "");
    expect(getApiKey()).toBe("");
    expect(authHeaders()).toEqual({});
  });

  it("sends the configured key as a bearer token", () => {
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    expect(getApiKey()).toBe("local-dev-key");
    expect(authHeaders()).toEqual({ Authorization: "Bearer local-dev-key" });
  });
});
