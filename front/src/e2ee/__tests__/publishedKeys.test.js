import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_KEY_BASE_URL,
  fetchPublishedKeyTexts,
  publishedKeyFileName,
  publishedKeyUrl,
} from "../publishedKeys";

describe("published key file names", () => {
  it("uses the model id verbatim when it is already a file name", () => {
    expect(publishedKeyFileName("qwen3-30b-a3b-instruct-2507")).toBe(
      "qwen3-30b-a3b-instruct-2507.pub",
    );
  });

  it("flattens a bridge id, which contains a slash", () => {
    expect(publishedKeyFileName("bridge/deepseek-v4.1-flash-1017")).toBe(
      "bridge-deepseek-v4.1-flash-1017.pub",
    );
  });

  it("replaces punctuation runs and trims edge dots", () => {
    expect(publishedKeyFileName("ACME Model (beta)")).toBe(
      "ACME-Model-beta.pub",
    );
    expect(publishedKeyFileName("..hidden..")).toBe("hidden.pub");
    expect(publishedKeyFileName("")).toBe("model.pub");
  });
});

describe("publishedKeyUrl", () => {
  it("appends the file to an absolute directory with or without a slash", () => {
    expect(publishedKeyUrl("https://keys.example/dir", "qwen-a")).toBe(
      "https://keys.example/dir/qwen-a.pub",
    );
    expect(publishedKeyUrl("https://keys.example/dir/", "qwen-a")).toBe(
      "https://keys.example/dir/qwen-a.pub",
    );
  });

  it("resolves a relative directory against the page", () => {
    expect(publishedKeyUrl("/keys/", "qwen-a")).toBe(
      `${globalThis.location.origin}/keys/qwen-a.pub`,
    );
  });

  it("refuses an empty base URL", () => {
    expect(() => publishedKeyUrl("  ", "qwen-a")).toThrow(/empty/);
  });
});

const response = (status, body = "") => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

describe("fetchPublishedKeyTexts", () => {
  it("splits found, missing and failed answers", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("qwen-a.pub")) return response(200, "PUBLIC-KEY");
      if (url.endsWith("mistral-b.pub")) return response(404);
      return response(500, "boom");
    });

    const models = [
      { id: "qwen-a", name: "Qwen A" },
      { id: "mistral-b", name: "Mistral B" },
      { id: "broken-c", name: "Broken C" },
    ];
    const result = await fetchPublishedKeyTexts({
      baseUrl: "https://keys.example/",
      models,
      fetchImpl,
    });

    expect(result.found).toEqual([
      {
        model: models[0],
        url: "https://keys.example/qwen-a.pub",
        text: "PUBLIC-KEY",
      },
    ]);
    expect(result.missing).toEqual([models[1]]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].model).toBe(models[2]);
    expect(result.failed[0].reason).toBe("HTTP 500");
  });

  it("reports a network error per model instead of rejecting", async () => {
    const models = [{ id: "qwen-a" }];
    const result = await fetchPublishedKeyTexts({
      baseUrl: "https://keys.example/",
      models,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });

    expect(result.found).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.failed[0]).toMatchObject({
      model: models[0],
      reason: "offline",
    });
  });

  it("keeps the result order and reports progress once per model", async () => {
    const models = ["a", "b", "c", "d"].map((id) => ({ id }));
    const progress = [];
    const fetchImpl = async (url) =>
      url.endsWith("b.pub") ? response(404) : response(200, "key");

    const result = await fetchPublishedKeyTexts({
      baseUrl: "https://keys.example/",
      models,
      fetchImpl,
      onProgress: (state) => progress.push(state),
    });

    expect(result.found.map((entry) => entry.model.id)).toEqual(["a", "c", "d"]);
    expect(result.missing.map((model) => model.id)).toEqual(["b"]);
    expect(progress.at(-1)).toEqual({ done: 4, total: 4 });
  });

  it("does not touch the network without models", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchPublishedKeyTexts({
      baseUrl: "https://keys.example/",
      models: [],
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ found: [], missing: [], failed: [] });
  });

  it("fetches a key directory without the app's credentials", async () => {
    const fetchImpl = vi.fn(async () => response(200, "key"));
    await fetchPublishedKeyTexts({
      baseUrl: "https://keys.example/",
      models: [{ id: "qwen-a" }],
      fetchImpl,
    });

    const [, init] = fetchImpl.mock.calls[0];
    // The bearer token belongs to the model endpoint, not to a public key host.
    expect(init.headers.Authorization).toBeUndefined();
    // A rotated key must not be served from the HTTP cache.
    expect(init.cache).toBe("no-cache");
  });

  it("defaults the directory to the GWDG docs host", () => {
    expect(DEFAULT_KEY_BASE_URL).toBe(
      "https://docs.ai.gwdg.de/technical/saia-platform/keys/",
    );
  });
});
