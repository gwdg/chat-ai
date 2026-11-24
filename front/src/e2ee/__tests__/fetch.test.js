import { beforeEach, describe, expect, it, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import { E2eeKeyError, ResponseSealer, keyId, openRequest } from "../protocol";
import { createE2eeFetch } from "../fetch";

vi.mock("../registry", () => ({ resolveKeyForModel: vi.fn() }));

import { resolveKeyForModel } from "../registry";

const nodePrivate = x25519.utils.randomSecretKey();
const nodePublic = x25519.getPublicKey(nodePrivate);
const resolvedKey = { nodePublic, kid: "test-kid" };

const url = "http://localhost:8081/chat/completions";
const payload = {
  messages: [
    { role: "system", content: "Be brief." },
    { role: "user", content: "Hallo Welt" },
  ],
  temperature: 0.5,
  stream: false,
};

const init = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Base fetch that opens the sealed request and builds a sealed answer. */
function sealedFetch(makeResponse) {
  const calls = [];
  const baseFetch = vi.fn(async (target, request) => {
    calls.push({ target, request });
    // Mirror the node: the cleartext routing hints are not payload, so they are
    // removed before the strict envelope check and then reconciled.
    const raw = JSON.parse(request.body);
    const hint = raw.stream;
    delete raw.stream;
    const opened = openRequest({
      body: raw,
      path: new URL(target).pathname,
      nodePrivate,
    });
    expect(Boolean(hint)).toBe(Boolean(opened.payload.stream));
    return makeResponse(opened);
  });
  return { baseFetch, calls };
}

const jsonResponse = (body, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const sseResponse = (text) =>
  new Response(text, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });

const sseChunk = (value) => `data: ${JSON.stringify(value)}\n\n`;

beforeEach(() => {
  resolveKeyForModel.mockReset();
});

describe("passthrough", () => {
  it("forwards an unkeyed model unchanged", async () => {
    resolveKeyForModel.mockResolvedValue(null);
    const baseFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const fetch = createE2eeFetch(baseFetch);
    const request = init({ model: "qwen-unkeyed", ...payload });

    const response = await fetch(url, request);
    expect(await response.json()).toEqual({ ok: true });
    expect(baseFetch).toHaveBeenCalledWith(url, request);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("does not touch non-chat endpoints", async () => {
    const baseFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const fetch = createE2eeFetch(baseFetch);
    const request = init({ model: "qwen-keyed", ...payload });

    await fetch("http://localhost:8081/documents/convert/file", request);
    expect(resolveKeyForModel).not.toHaveBeenCalled();
    expect(baseFetch).toHaveBeenCalledWith(
      "http://localhost:8081/documents/convert/file",
      request,
    );
  });

  it("leaves a body it cannot parse alone", async () => {
    const baseFetch = vi.fn(async () => jsonResponse({ ok: true }));
    const fetch = createE2eeFetch(baseFetch);
    const request = { method: "POST", body: "not json" };

    await fetch(url, request);
    expect(baseFetch).toHaveBeenCalledWith(url, request);
  });
});

describe("sealing", () => {
  it("replaces the request with model, e2ee and the stream hint only", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const { baseFetch, calls } = sealedFetch((opened) =>
      jsonResponse(
        JSON.stringify(new ResponseSealer(opened.responseKey).seal("{}")),
      ),
    );
    const fetch = createE2eeFetch(baseFetch);

    await fetch(url, init({ model: "qwen-keyed", ...payload }));

    expect(resolveKeyForModel).toHaveBeenCalledWith("qwen-keyed");
    expect(calls).toHaveLength(1);
    const sealed = JSON.parse(calls[0].request.body);
    expect(Object.keys(sealed).sort()).toEqual(["e2ee", "model", "stream"]);
    expect(sealed.model).toBe("qwen-keyed");
    expect(sealed.stream).toBe(false);
    expect(sealed.e2ee.kid).toBe(keyId(nodePublic));
    expect(calls[0].request.body).not.toContain("Hallo Welt");
    expect(calls[0].request.headers.get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("blocks a keyed model whose key cannot be resolved", async () => {
    resolveKeyForModel.mockRejectedValue(
      new E2eeKeyError("The key assigned to this model is missing."),
    );
    const baseFetch = vi.fn();
    const fetch = createE2eeFetch(baseFetch);

    await expect(fetch(url, init({ model: "qwen-keyed", ...payload }))).rejects.toThrow(
      /key assigned/,
    );
    expect(baseFetch).not.toHaveBeenCalled();
  });
});

describe("decrypting", () => {
  it("opens a sealed JSON answer", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const answer = {
      choices: [{ message: { role: "assistant", content: "Hi" } }],
      usage: { total_tokens: 3 },
    };
    const { baseFetch } = sealedFetch((opened) =>
      jsonResponse(
        JSON.stringify(
          new ResponseSealer(opened.responseKey).seal(JSON.stringify(answer)),
        ),
      ),
    );
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    expect(await response.json()).toEqual(answer);
  });

  it("refuses an unencrypted 2xx JSON body", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const baseFetch = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "cleartext" } }] }),
    );
    const fetch = createE2eeFetch(baseFetch);

    await expect(
      fetch(url, init({ model: "qwen-keyed", ...payload })),
    ).rejects.toThrow(/unencrypted body/);
  });

  it("passes a cleartext error body through", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const baseFetch = vi.fn(async () =>
      jsonResponse({ error: { message: "upstream rejected" } }),
    );
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    expect(await response.json()).toEqual({
      error: { message: "upstream rejected" },
    });
  });

  it("passes a non-2xx answer through untouched", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const raw = jsonResponse({ error: "unavailable" }, 503);
    const baseFetch = vi.fn(async () => raw);
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    expect(response).toBe(raw);
    expect(await response.text()).toContain("unavailable");
  });

  it("decrypts an SSE stream and appends [DONE]", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const { baseFetch } = sealedFetch((opened) => {
      const sealer = new ResponseSealer(opened.responseKey);
      const chunks = [
        sealer.event(JSON.stringify({ choices: [{ delta: { content: "Hi" } }] })),
        sealer.event(
          JSON.stringify({ choices: [{ delta: { content: " there" } }] }),
        ),
        sealer.final(),
      ];
      return sseResponse(chunks.map(sseChunk).join(""));
    });
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    const text = await response.text();
    expect(text).toContain('data: {"choices":[{"delta":{"content":"Hi"}}]}');
    expect(text).toContain(" there");
    expect(text).not.toContain("e2ee");
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("lets cleartext usage through but refuses cleartext choices", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const withUsage = sealedFetch((opened) => {
      const sealer = new ResponseSealer(opened.responseKey);
      return sseResponse(
        sseChunk({ usage: { total_tokens: 7 } }) +
          sseChunk(sealer.final()),
      );
    });
    const allowed = await createE2eeFetch(withUsage.baseFetch)(
      url,
      init({ model: "qwen-keyed", ...payload }),
    );
    const text = await allowed.text();
    expect(text).toContain('"total_tokens":7');
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);

    const cleartext = vi.fn(async () =>
      sseResponse(
        sseChunk({ choices: [{ delta: { content: "injected" } }] }),
      ),
    );
    const refused = await createE2eeFetch(cleartext)(
      url,
      init({ model: "qwen-keyed", ...payload }),
    );
    await expect(refused.text()).rejects.toThrow(/cleartext content/);
  });

  it("passes a cleartext provider error event that only has a type", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const { baseFetch } = sealedFetch((opened) => {
      const sealer = new ResponseSealer(opened.responseKey);
      return sseResponse(
        sseChunk({ type: "error", message: "upstream overloaded" }) +
          sseChunk(sealer.final()),
      );
    });
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    const text = await response.text();
    expect(text).toContain("upstream overloaded");
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("reduces a cleartext Responses terminal to identity and usage", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const terminal = {
      type: "response.completed",
      sequence_number: 2,
      response: {
        id: "resp_1",
        instructions: "system secret",
        output: [
          { content: [{ type: "output_text", text: "injected answer" }] },
        ],
        usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      },
    };
    const { baseFetch } = sealedFetch((opened) => {
      const sealer = new ResponseSealer(opened.responseKey);
      return sseResponse(
        sseChunk(terminal) + sseChunk(sealer.final()),
      );
    });
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    const text = await response.text();
    expect(text).not.toContain("injected answer");
    const first = text.split("\n").find((line) => line.startsWith("data: {"));
    const forwarded = JSON.parse(first.slice("data: ".length));
    expect(forwarded.response.output).toEqual([]);
    expect(forwarded.response.usage.total_tokens).toBe(5);
    expect(forwarded.response).not.toHaveProperty("instructions");
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("still refuses a cleartext Responses terminal without usage", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const { baseFetch } = sealedFetch((opened) => {
      const sealer = new ResponseSealer(opened.responseKey);
      return sseResponse(
        sseChunk({
          type: "response.completed",
          response: {
            output: [{ content: [{ type: "output_text", text: "injected" }] }],
          },
        }) + sseChunk(sealer.final()),
      );
    });
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    await expect(response.text()).rejects.toThrow(/cleartext content/);
  });

  it("refuses a stream that never sends the final marker", async () => {
    resolveKeyForModel.mockResolvedValue(resolvedKey);
    const { baseFetch } = sealedFetch((opened) => {
      const sealer = new ResponseSealer(opened.responseKey);
      return sseResponse(
        sseChunk(
          sealer.event(JSON.stringify({ choices: [{ delta: { content: "x" } }] })),
        ),
      );
    });
    const fetch = createE2eeFetch(baseFetch);

    const response = await fetch(url, init({ model: "qwen-keyed", ...payload }));
    await expect(response.text()).rejects.toThrow(/final/i);
  });
});
