#!/usr/bin/env node
// A tiny stand-in for the upstreams the mocked app expects, for use outside
// Playwright (`scripts/serve-apps.sh`). The browser suite intercepts these URLs
// with `page.route`, which only exists inside a test run; this server makes the
// same three endpoints answer when the app is opened by hand.
//
//   node scripts/mock-upstream.mjs            # :8091, the fixtures' backendPath
//   MOCK_PORT=9000 node scripts/mock-upstream.mjs
//
// It is deliberately plain Node (no dependencies) and answers:
//   GET  /models              the two deterministic models from tests/fixtures.ts
//   GET  /user                the sample user
//   POST /chat/completions    a streamed reply that echoes the last user message
//
// Keep the model id in step with `fixtures/front.e2e.json` (`default.model.id`):
// the app looks the stored model up in `/models` and falls back to a bare
// {id, name} object when it is missing.
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 8091);

const MODELS = [
  {
    id: "deepseek-v4.1-flash-1017",
    name: "Alpha Mock Model",
    description: "Deterministic test model used by the browser suite.",
    company: "GWDG",
    contextLength: 128000,
    releaseDate: "2026-01-01",
    external: false,
    input: ["text"],
    output: ["text"],
  },
  {
    id: "beta-mock-model",
    name: "Beta Mock Model",
    description: "Second deterministic model for selector tests.",
    company: "GWDG",
    contextLength: 64000,
    releaseDate: "2026-02-01",
    external: false,
    input: ["text"],
    output: ["text"],
  },
];

const TITLE = "Mocked conversation title";

const sseChunk = (delta, finishReason = null) =>
  `data: ${JSON.stringify({
    id: "chatcmpl-mock",
    object: "chat.completion.chunk",
    created: 1767225600,
    model: "alpha-mock-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;

const lastUserText = (body) => {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .map((part) =>
          part && typeof part === "object" && "text" in part
            ? String(part.text ?? "")
            : "",
        )
        .join(" ")
        .trim();
    }
  }
  return "";
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const json = (res, status, body) => {
  res.writeHead(status, { ...CORS, "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (path === "/models" && req.method === "GET") {
    json(res, 200, { data: MODELS });
    return;
  }

  if (path === "/user" && req.method === "GET") {
    json(res, 200, {
      username: "e2e-user",
      firstname: "E2E",
      lastname: "User",
      organization: "GWDG",
    });
    return;
  }

  if (path === "/chat/completions" && req.method === "POST") {
    const body = await readBody(req);
    const prompt = lastUserText(body);
    if (body.stream) {
      const text = prompt ? `Mocked reply to: ${prompt}` : "Mocked reply.";
      res.writeHead(200, {
        ...CORS,
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      res.end(
        [
          sseChunk({ role: "assistant", content: "" }),
          sseChunk({ content: text }),
          sseChunk({}, "stop"),
          "data: [DONE]\n\n",
        ].join(""),
      );
      return;
    }
    json(res, 200, {
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: 1767225600,
      model: "alpha-mock-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: TITLE },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    return;
  }

  json(res, 404, { message: `No mock for ${req.method} ${path}` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock upstream on http://127.0.0.1:${PORT} (/models, /user, /chat/completions)`);
});
