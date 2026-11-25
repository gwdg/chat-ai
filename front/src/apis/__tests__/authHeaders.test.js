import { afterEach, describe, expect, it, vi } from "vitest";
import { authHeaders, getApiKey, getFakeAuthHeaders } from "../authHeaders";

const fakeHeaders = {
  oidc_claim_uid: "local-fake",
  oidc_claim_email: "local-fake@example.org",
};

describe("authHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends nothing when no apiKey is configured", () => {
    vi.stubEnv("VITE_API_KEY", "");
    expect(getApiKey()).toBe("");
    expect(getFakeAuthHeaders()).toEqual({});
    expect(authHeaders()).toEqual({});
  });

  it("sends the configured key as a bearer token", () => {
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    expect(getApiKey()).toBe("local-dev-key");
    expect(authHeaders()).toEqual({ Authorization: "Bearer local-dev-key" });
  });

  it("sends the configured fake identity headers", () => {
    vi.stubEnv("VITE_API_KEY", "");
    vi.stubEnv("VITE_FAKE_AUTH_HEADERS", JSON.stringify(fakeHeaders));

    expect(getFakeAuthHeaders()).toEqual(fakeHeaders);
    expect(authHeaders()).toEqual(fakeHeaders);
  });

  it("combines fake identity headers with the apiKey", () => {
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    vi.stubEnv("VITE_FAKE_AUTH_HEADERS", JSON.stringify(fakeHeaders));

    expect(authHeaders()).toEqual({
      ...fakeHeaders,
      Authorization: "Bearer local-dev-key",
    });
  });

  it("lets the apiKey win over a fake Authorization header", () => {
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    vi.stubEnv(
      "VITE_FAKE_AUTH_HEADERS",
      JSON.stringify({ ...fakeHeaders, Authorization: "Bearer fake" })
    );

    expect(authHeaders()).toEqual({
      ...fakeHeaders,
      Authorization: "Bearer local-dev-key",
    });
  });

  it("ignores malformed or non-string fake headers", () => {
    vi.stubEnv("VITE_API_KEY", "");
    vi.stubEnv("VITE_FAKE_AUTH_HEADERS", "not json");
    expect(getFakeAuthHeaders()).toEqual({});

    vi.stubEnv(
      "VITE_FAKE_AUTH_HEADERS",
      JSON.stringify({ oidc_claim_uid: "local-fake", bad: 42 })
    );
    expect(getFakeAuthHeaders()).toEqual({ oidc_claim_uid: "local-fake" });
  });
});
