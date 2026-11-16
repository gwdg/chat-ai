// A fetch wrapper that seals requests for models bound to an E2EE key and
// decrypts the node's sealed answer.
//
// It is deliberately a transport-level wrapper: every caller that speaks
// `/chat/completions` gets the protection without changing its request code,
// and a keyed model can never fall back to a cleartext request.
import {
  ResponseDecryptor,
  openJsonResponse,
  randomPassword,
  sealRequest,
  verifyFinal,
} from "./protocol";
import { resolveKeyForModel } from "./registry";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class E2eeResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = "E2eeResponseError";
    this.code = "e2ee_response";
  }
}

const isChatCompletions = (url) => {
  try {
    const parsed = new URL(url, globalThis.location?.origin ?? "http://localhost");
    return parsed.pathname.endsWith("/chat/completions");
  } catch {
    return false;
  }
};

const requestUrl = (input) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.url === "string") return input.url;
  return "";
};

function encodeEvent({ event, id, data }) {
  let out = "";
  if (event) out += `event: ${event}\n`;
  if (id) out += `id: ${id}\n`;
  for (const line of String(data).split("\n")) out += `data: ${line}\n`;
  return encoder.encode(`${out}\n`);
}

// Incremental SSE parser: feed chunks, yield complete events.
async function* parseSse(body) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let event = null;
  let id = null;
  let data = [];
  const flush = function* () {
    if (data.length || event || id) {
      yield { event, id, data: data.join("\n") };
    }
    event = null;
    id = null;
    data = [];
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline;
      while ((newline = buffer.search(/\r\n|\r|\n/)) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(
          newline + (buffer.startsWith("\r\n", newline) ? 2 : 1),
        );
        if (line === "") {
          yield* flush();
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let valuePart = colon === -1 ? "" : line.slice(colon + 1);
        if (valuePart.startsWith(" ")) valuePart = valuePart.slice(1);
        if (field === "event") event = valuePart;
        else if (field === "id") id = valuePart;
        else if (field === "data") data.push(valuePart);
      }
    }
    if (buffer) {
      const colon = buffer.indexOf(":");
      const field = colon === -1 ? buffer : buffer.slice(0, colon);
      const valuePart = colon === -1 ? "" : buffer.slice(colon + 1).replace(/^ /, "");
      if (field === "data") data.push(valuePart);
      else if (field === "event") event = valuePart;
      else if (field === "id") id = valuePart;
    }
    yield* flush();
  } finally {
    reader.releaseLock();
  }
}

async function* decryptEvents(body, responseKey) {
  const decryptor = new ResponseDecryptor(responseKey);
  for await (const event of parseSse(body)) {
    if (event.data === "[DONE]") continue;
    let parsed;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      throw new E2eeResponseError(
        "The encrypted stream carried a non-JSON event; refusing to pass it on.",
      );
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new E2eeResponseError(
        "The encrypted stream carried an unexpected event; refusing to pass it on.",
      );
    }
    if (!parsed.e2ee) {
      // Billing usage and provider errors are cleartext on purpose. A cleartext
      // choices chunk could inject content, so it is refused instead.
      if (parsed.usage || parsed.error) {
        yield encodeEvent(event);
        continue;
      }
      throw new E2eeResponseError(
        "The encrypted stream carried cleartext content; refusing it.",
      );
    }
    const plaintext = decryptor.open(parsed.e2ee);
    if (plaintext === null) continue;
    yield encodeEvent({ event: event.event, id: event.id, data: plaintext });
  }
  verifyFinal(decryptor);
  yield encodeEvent({ data: "[DONE]" });
}

function streamFromAsyncIterable(iterable) {
  const iterator = iterable[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await iterator.return?.(reason);
    },
  });
}

const cleanedHeaders = (response) => {
  const headers = new Headers(response.headers);
  for (const name of ["content-length", "transfer-encoding", "content-encoding"]) {
    headers.delete(name);
  }
  return headers;
};

const passthroughBody = (response, raw) =>
  new Response(raw, {
    status: response.status,
    statusText: response.statusText,
    headers: cleanedHeaders(response),
  });

async function decryptJsonResponse(response, responseKey) {
  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not JSON after all (a proxy error page): forward it untouched.
    return passthroughBody(response, raw);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return passthroughBody(response, raw);
  }
  if (!parsed.e2ee) {
    // A non-2xx status or an OpenAI error object is cleartext on purpose.
    if (response.status >= 300 || parsed.error) {
      return passthroughBody(response, raw);
    }
    throw new E2eeResponseError(
      "The model answered with an unencrypted body. Only errors may be cleartext, so this response cannot be trusted.",
    );
  }
  const decrypted = openJsonResponse(parsed, responseKey);
  return new Response(JSON.stringify(decrypted), {
    status: response.status,
    statusText: response.statusText,
    headers: cleanedHeaders(response),
  });
}

function decryptStreamResponse(response, responseKey) {
  return new Response(
    streamFromAsyncIterable(decryptEvents(response.body, responseKey)),
    {
      status: response.status,
      statusText: response.statusText,
      headers: cleanedHeaders(response),
    },
  );
}

/**
 * Returns a fetch function with the same signature as `globalThis.fetch`.
 * `baseFetch` is injectable for tests.
 */
export function createE2eeFetch(baseFetch = (...args) => globalThis.fetch(...args)) {
  return async function e2eeFetch(input, init = {}) {
    const url = requestUrl(input);
    if (!isChatCompletions(url)) return baseFetch(input, init);

    const method = String(
      init.method ?? (typeof input === "object" ? input.method : "POST"),
    ).toUpperCase();
    if (method !== "POST") return baseFetch(input, init);

    if (typeof init.body !== "string") return baseFetch(input, init);
    let params;
    try {
      params = JSON.parse(init.body);
    } catch {
      return baseFetch(input, init);
    }
    const model = params?.model;
    if (typeof model !== "string" || !model) return baseFetch(input, init);

    // Throws for an assignment whose key is missing or unusable: fail closed.
    const resolved = await resolveKeyForModel(model);
    if (!resolved) return baseFetch(input, init);

    const { model: _model, e2ee: _e2ee, ...payload } = params;
    const path = new URL(
      url,
      globalThis.location?.origin ?? "http://localhost",
    ).pathname;
    const session = sealRequest({
      model,
      path,
      payload,
      nodePublic: resolved.nodePublic,
      password: randomPassword(),
    });
    const body = JSON.stringify({
      ...session.body,
      stream: Boolean(payload.stream),
    });

    const headers = new Headers(init.headers ?? {});
    headers.set("Content-Type", "application/json");

    const response = await baseFetch(url, { ...init, body, headers });
    if (response.status >= 400) return response;
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type.includes("text/event-stream")) {
      return decryptStreamResponse(response, session.responseKey);
    }
    if (type.includes("application/json")) {
      return decryptJsonResponse(response, session.responseKey);
    }
    return response;
  };
}

let sharedFetch;
/** The app-wide wrapper, so every hop shares one implementation. */
export function e2eeFetch(input, init) {
  sharedFetch ??= createE2eeFetch();
  return sharedFetch(input, init);
}

export function isE2eeRequest(url) {
  return isChatCompletions(url);
}
