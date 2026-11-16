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
});
