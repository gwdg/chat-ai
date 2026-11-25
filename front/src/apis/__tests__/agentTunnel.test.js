import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentTunnelEnabled,
  tunnelBody,
  tunnelRequest,
  tunnelStream,
} from "../agentTunnel";

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const completion = (boxed) =>
  jsonResponse({
    id: "chatcmpl-test",
    object: "chat.completion",
    model: "saia-agent",
    choices: [],
    chat_ai_http: boxed,
  });

const b64 = (text) => btoa(text);

describe("agentTunnel", () => {
  let fetchMock;

  beforeEach(() => {
    vi.stubEnv("VITE_BACKEND_ENDPOINT", "http://backend.test/v1");
    vi.stubEnv("VITE_AGENT_SERVICE_MODE", "tunnel");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is off unless the mode says tunnel", () => {
    expect(agentTunnelEnabled()).toBe(true);
    vi.stubEnv("VITE_AGENT_SERVICE_MODE", "");
    expect(agentTunnelEnabled()).toBe(false);
  });

  it("carries the request in the chat completion body", async () => {
    fetchMock.mockResolvedValue(
      completion({ status: 200, headers: {}, body: [] }),
    );

    await tunnelRequest({ method: "GET", path: "/agents" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://backend.test/v1/chat/completions");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("saia-agent");
    expect(body.messages).toEqual([]);
    expect(body.chat_ai_http).toEqual({
      method: "GET",
      path: "/agents",
      body: null,
      headers: {},
      stream: false,
    });
  });

  it("rebuilds the boxed JSON response", async () => {
    fetchMock.mockResolvedValue(
      completion({
        status: 201,
        headers: { "content-type": "application/json" },
        body: { id: "abc", status: "running" },
      }),
    );

    const response = await tunnelRequest({ method: "POST", path: "/agents" });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "abc",
      status: "running",
    });
  });

  it("keeps an error status instead of raising", async () => {
    fetchMock.mockResolvedValue(
      completion({
        status: 404,
        headers: { "content-type": "application/json" },
        body: { detail: "not found", code: "not_found" },
      }),
    );

    const response = await tunnelRequest({ path: "/agents/missing" });

    expect(response.ok).toBe(false);
    await expect(response.json()).resolves.toMatchObject({ code: "not_found" });
  });

  it("gives a 204 no body, which a Response cannot carry otherwise", async () => {
    fetchMock.mockResolvedValue(completion({ status: 204, headers: {} }));

    const response = await tunnelRequest({
      method: "DELETE",
      path: "/agents/abc",
    });

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });

  it("decodes a base64 body for binary payloads", async () => {
    fetchMock.mockResolvedValue(
      completion({
        status: 200,
        headers: { "content-type": "application/octet-stream" },
        text: b64("hello"),
        encoding: "base64",
      }),
    );

    const response = await tunnelRequest({ path: "/agents/abc/file" });

    await expect(response.text()).resolves.toBe("hello");
  });

  it("passes an engine-level refusal through unchanged", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "Unauthorized" }, 401),
    );

    const response = await tunnelRequest({ path: "/agents" });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ detail: "Unauthorized" });
  });

  it("reports a completion without an envelope as a bad gateway", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    const response = await tunnelRequest({ path: "/agents" });

    expect(response.status).toBe(502);
  });

  it("decodes a streamed target into its plain bytes", async () => {
    const encoder = new TextEncoder();
    const frames = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: b64("data: one") } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: b64("\n\ndata: two\n\n") } }] })}\n\n`,
      "data: [DONE]\n\n",
    ];
    const body = new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    });
    fetchMock.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const response = await tunnelStream({ path: "/agents/abc/opencode/api/event" });

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Both the completion and the carried call are streamed, or the engine
    // buffers the body and nothing arrives until the target ends.
    expect(sent.stream).toBe(true);
    expect(sent.chat_ai_http).toMatchObject({ stream: true });
    const text = await new Response(response.body).text();
    expect(text).toBe("data: one\n\ndata: two\n\n");
  });

  it("boxes a JSON string body as JSON, and keeps a plain string as text", () => {
    expect(tunnelBody('{"name":"x"}')).toEqual({ name: "x" });
    expect(tunnelBody({ name: "x" })).toEqual({ name: "x" });
    expect(tunnelBody(null)).toBeNull();
    expect(tunnelBody("plain text")).toBe("plain text");
  });
});
