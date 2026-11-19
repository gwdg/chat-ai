// Transport for deployments where the browser cannot reach `/agents` directly.
//
// SAIA forwards model traffic to the service's `POST /v1/chat/completions` and
// copies only the `content-type` header (see saia-engine's `handle_hpc`), so the
// request has to travel in the JSON body — a header or query string would be
// dropped on that hop. The service answers with the real response boxed under
// `chat_ai_http` (see agent-service's `tunnel.py`).
//
// This module keeps the shape the rest of the app already expects: it returns a
// real `Response` (status, headers, body), so `agentService.js` and
// `opencodeAgents.js` keep their existing error and conflict handling.
//
// Turn it on with `"agentServiceMode": "tunnel"` in front.json. The agent bridge
// is a WebSocket and cannot ride on a chat completion; the service answers its
// `bridge` paths with 404, which the UI already reports as "no bridge here".

import { authHeaders } from "./authHeaders";

const MODEL = () => import.meta.env.VITE_AGENT_SERVICE_MODEL || "saia-agent";

/** True when the agent service is reached through the model endpoint. */
export const agentTunnelEnabled = () =>
  import.meta.env.VITE_AGENT_SERVICE_MODE === "tunnel";

const completionsUrl = () => {
  const endpoint = String(import.meta.env.VITE_BACKEND_ENDPOINT || "/").replace(
    /\/+$/,
    "",
  );
  return `${endpoint}/chat/completions`;
};

const base64Bytes = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const callBody = ({ method = "GET", path, body = null, headers = {}, stream = false }) => ({
  method: String(method).toUpperCase(),
  path,
  body,
  headers,
  stream,
});

async function post(call, signal) {
  return fetch(completionsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      model: MODEL(),
      messages: [],
      // The engine forwards an answer incrementally only for a streamed
      // completion; without this it collects the whole SSE body first, and an
      // event stream that never ends would never arrive.
      ...(call.stream ? { stream: true } : {}),
      chat_ai_http: call,
    }),
    signal,
  });
}

/** Rebuild the boxed response so callers see the real status and body. */
const toResponse = (boxed) => {
  const headers = new Headers(boxed?.headers || {});
  let body = "";
  if (boxed?.encoding === "base64") {
    body = base64Bytes(boxed.text || "");
  } else if (boxed?.body !== undefined && boxed?.body !== null) {
    body = JSON.stringify(boxed.body);
  } else if (typeof boxed?.text === "string") {
    body = boxed.text;
  }
  const status = boxed?.status ?? 502;
  // A null-body status cannot carry one; `new Response("", {status: 204})` throws.
  const nullBody = status === 204 || status === 205 || status === 304;
  return new Response(nullBody ? null : body, { status, headers });
};

/** Fetch one `/agents` request through the model endpoint. */
export async function tunnelRequest(call, signal) {
  const response = await post(callBody(call), signal);
  if (!response.ok) {
    // The engine (not the service) refused: keep its status and body so the
    // caller's existing error handling still applies.
    return new Response(await response.text().catch(() => ""), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }
  const payload = await response.json().catch(() => null);
  const boxed = payload?.chat_ai_http;
  if (!boxed) {
    return new Response("The agent service tunnel returned no response.", {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }
  return toResponse(boxed);
}

/**
 * Forward a streaming target (`/agents/<id>/opencode/api/event`).
 *
 * The service sends the target's bytes base64-encoded in chat-completion
 * deltas; this decodes them back into the plain SSE bytes the OpenCode client
 * already parses, so `subscribeOpencodeEvents` needs no second implementation.
 */
export async function tunnelStream(call, signal) {
  const response = await post(callBody({ ...call, stream: true }), signal);
  if (!response.ok || !response.body) {
    return new Response(await response.text().catch(() => ""), {
      status: response.ok ? 502 : response.status,
      headers: { "content-type": "text/event-stream" },
    });
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  const stream = new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += value;
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        let pushed = false;
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");
          if (!data) continue;
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          let delta;
          try {
            delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
          } catch {
            continue;
          }
          if (!delta) continue;
          controller.enqueue(base64Bytes(delta));
          pushed = true;
        }
        if (pushed) return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** A fetch body is a JSON string in the OpenCode client; box it as JSON. */
export const tunnelBody = (body) => {
  if (body === undefined || body === null) return null;
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};
