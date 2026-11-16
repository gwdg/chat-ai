import { afterEach, describe, expect, it, vi } from "vitest";
import { getUserData } from "../getUserData";

describe("getUserData", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("skips the request when no userDataPath is configured", async () => {
    vi.stubEnv("VITE_USERDATA_ENDPOINT", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUserData()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the configured apiKey to the user endpoint", async () => {
    vi.stubEnv("VITE_USERDATA_ENDPOINT", "http://backend.test/user");
    vi.stubEnv("VITE_API_KEY", "local-dev-key");
    const fetchMock = vi.fn(async () =>
      new Response('{"username":"tester"}', {
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUserData()).resolves.toEqual({ username: "tester" });
    expect(fetchMock).toHaveBeenCalledWith("http://backend.test/user", {
      headers: { Authorization: "Bearer local-dev-key" },
    });
  });

  it("sends the configured fake identity headers", async () => {
    vi.stubEnv("VITE_USERDATA_ENDPOINT", "/assumes_behind_oidc/user");
    vi.stubEnv("VITE_API_KEY", "");
    vi.stubEnv(
      "VITE_FAKE_AUTH_HEADERS",
      JSON.stringify({ oidc_claim_uid: "local-fake" })
    );
    const fetchMock = vi.fn(async () =>
      new Response('{"username":"local-fake"}', {
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getUserData()).resolves.toEqual({ username: "local-fake" });
    expect(fetchMock).toHaveBeenCalledWith("/assumes_behind_oidc/user", {
      headers: { oidc_claim_uid: "local-fake" },
    });
  });
});
