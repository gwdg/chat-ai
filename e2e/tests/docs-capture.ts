/*
 * Shared fixtures for the documentation screenshots.
 *
 * The three captures (model picker, persona library, MCP server) live in their
 * own spec files so each one writes to its own scenario directory: the runner
 * numbers steps per scenario, and a single directory made the post-run vision
 * check compare one scenario's steps against another's screenshots.
 */

/**
 * A model list shaped like the one SAIA returns: `description` on the first row
 * selects the extended selector (AGENTS.md §4.12), and `external` is what the
 * orange warning triangle and the "External" chip read.
 */
export const DOC_MODELS = [
  {
    id: "deepseek-v4.1-flash-1017",
    name: "DeepSeek V4.1 Flash",
    description: "Open-weight model hosted by GWDG.",
    company: "GWDG",
    contextLength: 262144,
    releaseDate: "2026-10-17",
    external: false,
    input: ["text"],
    output: ["text"],
    status: "ready",
  },
  {
    id: "gemma-4-31b-it",
    name: "Gemma 4 31B Instruct",
    description: "Vision and text, hosted by GWDG.",
    company: "GWDG",
    contextLength: 256000,
    releaseDate: "2026-04-01",
    external: false,
    input: ["text", "image"],
    output: ["text"],
    status: "ready",
  },
  {
    id: "qwen3.6-35b-a3b",
    name: "Qwen 3.6 35B A3B",
    description: "Fast multimodal model hosted by GWDG.",
    company: "GWDG",
    contextLength: 262144,
    releaseDate: "2026-04-01",
    external: false,
    input: ["text", "image"],
    output: ["text"],
    status: "ready",
  },
  {
    id: "openai-gpt5.6-sol",
    name: "GPT-5.6 Sol",
    description: "Frontier model hosted by OpenAI.",
    company: "OpenAI",
    contextLength: 1050000,
    releaseDate: "2026-07-01",
    external: true,
    input: ["text"],
    output: ["text"],
    status: "ready",
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    description: "Agentic model hosted by Anthropic.",
    company: "Anthropic",
    contextLength: 1000000,
    releaseDate: "2026-06-01",
    external: true,
    input: ["text"],
    output: ["text"],
    status: "ready",
  },
];

const corsJson = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  headers: { "access-control-allow-origin": "*" },
  body: JSON.stringify(body),
});

/** Registers after the fixture's `mockApi`, so this list wins. */
export async function useDocumentationModels(page: import("@playwright/test").Page) {
  await page.route(/\/models(\?.*)?$/, (route) =>
    route.fulfill(corsJson({ data: DOC_MODELS })),
  );
}

const PERSONA_BASE =
  "https://raw.githubusercontent.com/gwdg/chat-ai-personas/main";

const PERSONAS: Record<string, unknown> = {
  "assistant.json": {
    title: "Assistant",
    subtitle: "A general-purpose assistant for everyday questions.",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      {
        role: "info",
        content: "Ask anything; the assistant answers in plain language.",
      },
    ],
  },
  "gwdg-support.json": {
    title: "GWDG Support",
    subtitle: "Answers questions about GWDG services.",
    messages: [
      { role: "system", content: "You answer questions about GWDG services." },
    ],
  },
  "translation/de_en.json": {
    title: "German to English",
    subtitle: "Translates German text into English, without commentary.",
    model: "qwen3.6-35b-a3b",
    "model-name": "Qwen 3.6 35B A3B",
    messages: [
      {
        role: "system",
        content:
          "Translate the German text the user sends into English. Answer with the translation only.",
      },
      {
        role: "info",
        content: "Send a German sentence; the reply is its English translation.",
      },
    ],
  },
  "translation/en_de.json": {
    title: "English to German",
    subtitle: "Translates English text into German, without commentary.",
    messages: [
      {
        role: "system",
        content:
          "Translate the English text the user sends into German. Answer with the translation only.",
      },
    ],
  },
};

const personaEntry = (
  name: string,
  type: "file" | "dir",
  path: string,
): Record<string, unknown> => ({
  name,
  path,
  type,
  sha: `${type}-${path}`,
  ...(type === "file"
    ? {
        size: 1536,
        download_url: `${PERSONA_BASE}/${path}`,
      }
    : {}),
});

/** The GitHub tree the persona library reads, plus the persona files themselves. */
export async function mockPersonaCatalog(page: import("@playwright/test").Page) {
  await page.route(
    /https:\/\/api\.github\.com\/repos\/gwdg\/chat-ai-personas\/contents/,
    (route) => {
      const path = new URL(route.request().url()).pathname.split("/contents/")[1] ?? "";
      const folder = path.replace(/\/$/, "");
      if (!folder) {
        return route.fulfill(
          corsJson([
            personaEntry("translation", "dir", "translation"),
            personaEntry("examples", "dir", "examples"),
            personaEntry("assistant.json", "file", "assistant.json"),
            personaEntry("gwdg-support.json", "file", "gwdg-support.json"),
          ]),
        );
      }
      if (folder === "translation") {
        return route.fulfill(
          corsJson([
            personaEntry("de_en.json", "file", "translation/de_en.json"),
            personaEntry("en_de.json", "file", "translation/en_de.json"),
          ]),
        );
      }
      return route.fulfill(corsJson([]));
    },
  );

  await page.route(new RegExp(`^${PERSONA_BASE}/`), (route) => {
    const path = route.request().url().slice(PERSONA_BASE.length + 1).split("?")[0];
    const persona = PERSONAS[path];
    if (!persona) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill(corsJson(persona));
  });
}

/**
 * The MCP handshake the settings "Test connection" button runs. Answering the
 * streamable-HTTP exchange here keeps the status light green without a real
 * server, and the two tools make the reported count plausible.
 */
export async function mockMcpServer(page: import("@playwright/test").Page) {
  await page.route("https://mcp.deepwiki.com/mcp", (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          "access-control-allow-headers": "*",
          "access-control-expose-headers": "mcp-session-id",
        },
      });
    }

    const body = (request.postDataJSON?.() ?? {}) as {
      id?: number | string;
      method?: string;
    };
    const reply = (result: unknown) =>
      route.fulfill(
        corsJson({ jsonrpc: "2.0", id: body.id ?? null, result }),
      );

    if (body.method === "initialize") {
      return reply({
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "DeepWiki", version: "1.2.0" },
      });
    }
    if (body.method === "notifications/initialized") {
      return route.fulfill({
        status: 202,
        headers: { "access-control-allow-origin": "*" },
      });
    }
    if (body.method === "tools/list") {
      return reply({
        tools: [
          {
            name: "read_wiki_structure",
            description: "List the sections of a repository wiki.",
            inputSchema: {
              type: "object",
              properties: { repoName: { type: "string" } },
              required: ["repoName"],
            },
          },
          {
            name: "ask_question",
            description: "Ask a question about a repository.",
            inputSchema: {
              type: "object",
              properties: {
                repoName: { type: "string" },
                question: { type: "string" },
              },
              required: ["repoName", "question"],
            },
          },
        ],
      });
    }
    return route.fulfill(
      corsJson({
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code: -32601, message: "Method not found" },
      }),
    );
  });
}
