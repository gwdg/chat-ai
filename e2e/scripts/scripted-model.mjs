#!/usr/bin/env node
/**
 * Deterministic "model" for the agentic OpenCode scenario.
 *
 * The scenario asks a real local OpenCode agent to do agentic work, so the tool
 * loop must be real — but a real model is not available in an offline test.
 * This process speaks the OpenAI chat-completions API and answers with a fixed
 * script instead of model output:
 *
 *   turn 1:  write hello.py → shell `python3 hello.py` → read hello.py → text
 *   turn 2:  edit hello.py  → shell `python3 hello.py` → text
 *
 * OpenCode runs the tools itself, so the file on disk, the shell exit code and
 * the tool results are genuine; only the choice of tool is scripted.
 *
 * `scripts/opencode-server.mjs` registers this server as the `scripted`
 * provider in the project's `opencode.json`, and Playwright starts it as a
 * web server while waiting for `GET /health`.
 *
 * Environment: E2E_SCRIPTED_MODEL_HOST (127.0.0.1), E2E_SCRIPTED_MODEL_PORT (4100).
 */
import { createServer } from "node:http";

const HOST = process.env.E2E_SCRIPTED_MODEL_HOST ?? "127.0.0.1";
const PORT = Number(process.env.E2E_SCRIPTED_MODEL_PORT ?? 4100);
const MODEL_ID = "agentic";

/** The file the scripted agent works on, relative to the OpenCode project. */
const TARGET_FILE = "hello.py";
const FIRST_SOURCE = 'print("hello from the scripted agent")\n';
const EDITED_SOURCE = 'print("hello from the edited agent")\n';

/** Tool results that belong to the current user turn (a new prompt resets it). */
const toolResultsInTurn = (messages) => {
  let start = 0;
  messages.forEach((message, index) => {
    if (message?.role === "user") start = index;
  });
  return messages
    .slice(start + 1)
    .filter((message) => message?.role === "tool").length;
};

const userTurns = (messages) =>
  messages.filter((message) => message?.role === "user").length;

/**
 * The scripted answer for one request.
 *
 * Turn 1 creates and verifies a script, turn 2 edits it and runs it again. The
 * step is derived from the tool results the client sent back, so the script
 * follows the real tool loop instead of counting requests, and a retry cannot
 * desynchronise it.
 */
const scriptedReply = (messages) => {
  const step = toolResultsInTurn(messages);
  const turn = Math.min(userTurns(messages), 2);

  if (turn >= 2) {
    if (step === 0) {
      return {
        label: "edit hello.py",
        tool: {
          id: "call_e2e_edit",
          name: "edit",
          arguments: {
            path: TARGET_FILE,
            oldString: FIRST_SOURCE.trimEnd(),
            newString: EDITED_SOURCE.trimEnd(),
          },
        },
      };
    }
    if (step === 1) {
      return {
        label: "shell python3 hello.py",
        tool: {
          id: "call_e2e_rerun",
          name: "shell",
          arguments: { command: "python3 hello.py" },
        },
      };
    }
    return {
      label: 'text "edited"',
      text:
        "The greeting now says **edited**. I changed the first line of `hello.py` " +
        "and ran it again; the new output is shown in the shell call above.",
    };
  }

  if (step === 0) {
    return {
      label: "write hello.py",
      tool: {
        id: "call_e2e_write",
        name: "write",
        arguments: { path: TARGET_FILE, content: FIRST_SOURCE },
      },
    };
  }
  if (step === 1) {
    return {
      label: "shell python3 hello.py",
      tool: {
        id: "call_e2e_shell",
        name: "shell",
        arguments: { command: "python3 hello.py" },
      },
    };
  }
  if (step === 2) {
    return {
      label: "read hello.py",
      tool: {
        id: "call_e2e_read",
        name: "read",
        arguments: { path: TARGET_FILE },
      },
    };
  }
  return {
    label: 'text "done"',
    text:
      "Done. I created `hello.py`, ran it with `python3`, and read the file back " +
      "to confirm its content. The script printed **hello from the scripted agent**.",
  };
};

const chunk = (model, delta, finishReason = null) => ({
  id: "chatcmpl-scripted-e2e",
  object: "chat.completion.chunk",
  created: 1767225600,
  model,
  choices: [{ index: 0, delta, finish_reason: finishReason }],
});

/**
 * Stream one assistant message. A tool call sends its name in the first delta
 * and the JSON arguments in the second, which is the shape the OpenAI SDK and
 * OpenCode's client both accept.
 */
const stream = (res, model, reply) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const write = (delta, finishReason = null) =>
    res.write(`data: ${JSON.stringify(chunk(model, delta, finishReason))}\n\n`);

  if (reply.tool) {
    write({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          index: 0,
          id: reply.tool.id,
          type: "function",
          function: { name: reply.tool.name, arguments: "" },
        },
      ],
    });
    write({
      tool_calls: [
        {
          index: 0,
          function: { arguments: JSON.stringify(reply.tool.arguments) },
        },
      ],
    });
    write({}, "tool_calls");
  } else {
    write({ role: "assistant", content: "" });
    write({ content: reply.text });
    write({}, "stop");
  }

  res.write("data: [DONE]\n\n");
  res.end();
};

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, model: MODEL_ID });
  }

  // Some OpenAI-compatible clients probe the catalogue before chatting.
  if (req.method === "GET" && url.pathname === "/v1/models") {
    return json(res, 200, {
      object: "list",
      data: [{ id: MODEL_ID, object: "model", owned_by: "chat-ai-e2e" }],
    });
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    let raw = "";
    req.on("data", (part) => (raw += part));
    req.on("end", () => {
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return json(res, 400, { error: { message: "Invalid JSON body" } });
      }

      const messages = Array.isArray(body.messages) ? body.messages : [];
      const turn = userTurns(messages);
      const reply = scriptedReply(messages);
      console.log(
        `[scripted-model] turn=${turn} step=${toolResultsInTurn(messages)} -> ${reply.label}`,
      );

      if (body.stream === false) {
        const message = reply.tool
          ? {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: reply.tool.id,
                  type: "function",
                  function: {
                    name: reply.tool.name,
                    arguments: JSON.stringify(reply.tool.arguments),
                  },
                },
              ],
            }
          : { role: "assistant", content: reply.text };
        return json(res, 200, {
          id: "chatcmpl-scripted-e2e",
          object: "chat.completion",
          created: 1767225600,
          model: body.model ?? MODEL_ID,
          choices: [
            {
              index: 0,
              message,
              finish_reason: reply.tool ? "tool_calls" : "stop",
            },
          ],
        });
      }

      stream(res, body.model ?? MODEL_ID, reply);
    });
    return;
  }

  json(res, 404, {
    error: { message: `Unsupported route ${req.method} ${url.pathname}` },
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Scripted model ready at http://${HOST}:${PORT} (model ${MODEL_ID}).`);
});

const stop = () => server.close(() => process.exit(0));
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
