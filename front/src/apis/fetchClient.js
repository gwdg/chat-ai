// Minimal fetch-based replacement for the parts of the openai SDK we use:
// `client.chat.completions.create(params, { signal })`, streaming or not.
//
// Behaviour deliberately mirrors openai v6 so callers need no changes:
// - errors are `APIError`s with `status`, `error` (the body's `error` object),
//   `code`, `type` and a "<status> <message>" message;
// - `timeout` covers the time until response headers arrive;
// - 408/409/429/5xx and connection failures are retried up to twice with
//   backoff (honouring `retry-after` / `retry-after-ms` / `x-should-retry`);
// - aborting before the response throws "Request was aborted.", aborting
//   mid-stream simply ends the stream;
// - an SSE `error` event, or a chunk carrying `error`, throws an `APIError`.

const MAX_RETRIES = 2;

export class APIError extends Error {
  constructor(status, error, message, headers) {
    super(APIError.makeMessage(status, error, message));
    this.name = "APIError";
    this.status = status;
    this.headers = headers;
    this.requestID = headers?.get?.("x-request-id");
    this.error = error;
    this.code = error?.code;
    this.param = error?.param;
    this.type = error?.type;
  }

  static makeMessage(status, error, message) {
    const msg = error?.message
      ? typeof error.message === "string"
        ? error.message
        : JSON.stringify(error.message)
      : error
        ? JSON.stringify(error)
        : message;
    if (status && msg) return `${status} ${msg}`;
    if (status) return `${status} status code (no body)`;
    return msg || "(no status code or body)";
  }
}

export class APIUserAbortError extends APIError {
  constructor() {
    super(undefined, undefined, "Request was aborted.");
    this.name = "APIUserAbortError";
  }
}

export class APIConnectionError extends APIError {
  constructor(message = "Connection error.", cause) {
    super(undefined, undefined, message);
    this.name = "APIConnectionError";
    if (cause) this.cause = cause;
  }
}

export class APIConnectionTimeoutError extends APIConnectionError {
  constructor() {
    super("Request timed out.");
    this.name = "APIConnectionTimeoutError";
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (response) => {
  const header = response.headers.get("x-should-retry");
  if (header === "true") return true;
  if (header === "false") return false;
  const { status } = response;
  return status === 408 || status === 409 || status === 429 || status >= 500;
};

const retryDelay = (retriesRemaining, headers) => {
  const ms = Number.parseFloat(headers?.get("retry-after-ms") ?? "");
  if (Number.isFinite(ms) && ms >= 0 && ms < 60_000) return ms;
  const after = headers?.get("retry-after");
  if (after) {
    const secs = Number.parseFloat(after);
    const delay = Number.isFinite(secs)
      ? secs * 1000
      : Date.parse(after) - Date.now();
    if (Number.isFinite(delay) && delay >= 0 && delay < 60_000) return delay;
  }
  // Same curve as the SDK: 0.5s doubling, capped at 8s, up to 25% jitter.
  const attempt = MAX_RETRIES - retriesRemaining;
  const base = Math.min(0.5 * 2 ** attempt, 8);
  return base * (1 - Math.random() * 0.25) * 1000;
};

const parseErrorBody = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const errorFromResponse = async (response) => {
  const text = await response.text().catch(() => "");
  const json = parseErrorBody(text);
  return new APIError(
    response.status,
    json?.error,
    json ? json.message : text || undefined,
    response.headers
  );
};

// Fetch with a timeout that only covers waiting for the response headers.
const fetchOnce = async (url, init, timeout, userSignal) => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  // Stays attached after the headers arrive, so a user abort can still stop
  // an in-flight stream.
  const onUserAbort = () => controller.abort();
  userSignal?.addEventListener("abort", onUserAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    userSignal?.removeEventListener("abort", onUserAbort);
    if (userSignal?.aborted) throw new APIUserAbortError();
    if (timedOut) throw new APIConnectionTimeoutError();
    throw new APIConnectionError(undefined, err);
  } finally {
    clearTimeout(timer);
  }
};

const request = async (url, init, timeout, signal) => {
  for (let retriesRemaining = MAX_RETRIES; ; retriesRemaining--) {
    if (signal?.aborted) throw new APIUserAbortError();
    let response;
    try {
      response = await fetchOnce(url, init, timeout, signal);
    } catch (err) {
      if (err instanceof APIUserAbortError || !retriesRemaining) throw err;
      await sleep(retryDelay(retriesRemaining));
      continue;
    }
    if (response.ok) return response;
    if (retriesRemaining && shouldRetry(response)) {
      response.body?.cancel().catch(() => {});
      await sleep(retryDelay(retriesRemaining, response.headers));
      continue;
    }
    throw await errorFromResponse(response);
  }
};

// Parse a text/event-stream body into { event, data } messages.
async function* readSSE(body) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let event = null;
  let data = [];
  const flush = function* () {
    if (data.length || event) yield { event, data: data.join("\n") };
    event = null;
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
        buffer = buffer.slice(newline + (buffer.startsWith("\r\n", newline) ? 2 : 1));
        if (line === "") {
          yield* flush();
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let val = colon === -1 ? "" : line.slice(colon + 1);
        if (val.startsWith(" ")) val = val.slice(1);
        if (field === "event") event = val;
        else if (field === "data") data.push(val);
      }
    }
    if (buffer) {
      const colon = buffer.indexOf(":");
      if (buffer.slice(0, colon) === "data") {
        data.push(buffer.slice(colon + 1).replace(/^ /, ""));
      }
    }
    yield* flush();
  } finally {
    reader.releaseLock();
  }
}

async function* streamChunks(response) {
  try {
    for await (const sse of readSSE(response.body)) {
      if (sse.event?.startsWith("thread.")) continue;
      if (sse.data.startsWith("[DONE]")) return;
      if (sse.data === "") continue;
      let data;
      try {
        data = JSON.parse(sse.data);
      } catch (err) {
        console.error("Could not parse stream message", sse.data);
        throw err;
      }
      if (sse.event === "error" || data?.error) {
        throw new APIError(undefined, data?.error ?? data, undefined, response.headers);
      }
      yield data;
    }
  } catch (err) {
    // Aborting mid-stream ends the stream quietly, as with the SDK.
    if (err?.name === "AbortError") return;
    throw err;
  }
}

export function createFetchClient({ baseURL, timeout = 20000 }) {
  const url = `${baseURL.replace(/\/+$/, "")}/chat/completions`;
  return {
    chat: {
      completions: {
        async create(params, { signal } = {}) {
          const response = await request(
            url,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: params?.stream ? "text/event-stream" : "application/json",
              },
              body: JSON.stringify(params),
            },
            timeout,
            signal
          );
          if (params?.stream) return streamChunks(response);
          const text = await response.text();
          const type = response.headers.get("content-type") || "";
          return type.includes("json") ? JSON.parse(text) : text;
        },
      },
    },
  };
}
