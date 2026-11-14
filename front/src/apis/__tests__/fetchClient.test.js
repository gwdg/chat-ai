import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APIError, createFetchClient } from "../fetchClient";

const sseResponse = (chunks, init = {}) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
    ...init,
  });
};

const jsonResponse = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const collect = async (iter) => {
  const out = [];
  for await (const x of iter) out.push(x);
  return out;
};

describe("fetchClient", () => {
  let fetchMock;
  const client = () =>
    createFetchClient({ baseURL: "http://backend.test/", timeout: 1000 });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("posts JSON to /chat/completions without an Authorization header", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hi" } }] }));
    const res = await client().chat.completions.create({ model: "m", messages: [] });

    expect(res.choices[0].message.content).toBe("hi");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend.test/chat/completions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ model: "m", messages: [] });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("parses SSE chunks split across reads and stops at [DONE]", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"He"}}]}\n\nda',
        'ta: {"choices":[{"delta":{"content":"llo"}}]}\r\n\r\n',
        ": keep-alive\n\n",
        "data: [DONE]\n\n",
        'data: {"ignored":true}\n\n',
      ])
    );
    const stream = await client().chat.completions.create({ stream: true });
    const chunks = await collect(stream);
    expect(chunks.map((c) => c.choices[0].delta.content)).toEqual(["He", "llo"]);
  });

  it("passes gateway error objects through as chunks", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"object":"error","message":"quota"}\n\n'])
    );
    const chunks = await collect(
      await client().chat.completions.create({ stream: true })
    );
    expect(chunks).toEqual([{ object: "error", message: "quota" }]);
  });

  it("throws an APIError for a chunk carrying `error`", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"error":{"message":"boom","type":"server"}}\n\n'])
    );
    const stream = await client().chat.completions.create({ stream: true });
    await expect(collect(stream)).rejects.toMatchObject({
      message: "boom",
      type: "server",
    });
  });

  it("shapes HTTP errors like the openai SDK", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "bad model", code: "invalid", type: "req" } }, 400)
    );
    const err = await client()
      .chat.completions.create({})
      .catch((e) => e);
    expect(err).toBeInstanceOf(APIError);
    expect(err).toMatchObject({
      status: 400,
      code: "invalid",
      type: "req",
      message: "400 bad model",
      error: { message: "bad model", code: "invalid", type: "req" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx and 429 responses, honouring retry-after-ms", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 503, { "retry-after-ms": "1" }))
      .mockResolvedValueOnce(jsonResponse({}, 429, { "retry-after-ms": "1" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(client().chat.completions.create({})).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after two retries", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: { message: "down" } }, 500, { "retry-after-ms": "1" })
    );
    await expect(client().chat.completions.create({})).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws 'Request was aborted.' when aborted before the response", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      client().chat.completions.create({}, { signal: controller.signal })
    ).rejects.toMatchObject({ message: "Request was aborted." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ends the stream quietly when aborted mid-stream", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async (_url, init) => {
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"n":1}\n\n'));
          init.signal.addEventListener("abort", () =>
            c.error(new DOMException("aborted", "AbortError"))
          );
        },
      });
      return new Response(body, { status: 200 });
    });
    const stream = await client().chat.completions.create(
      { stream: true },
      { signal: controller.signal }
    );
    const out = [];
    for await (const chunk of stream) {
      out.push(chunk);
      controller.abort();
    }
    expect(out).toEqual([{ n: 1 }]);
  });
});
