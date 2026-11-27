#!/usr/bin/env node
// A deterministic stand-in for saia-rag, the SAIA document-collections service.
//
//   node scripts/mock-saia-rag.mjs            # :8096, what front.e2e-rag.json points at
//   MOCK_RAG_PORT=9100 node scripts/mock-saia-rag.mjs
//
// Chat AI reaches the service at `<backendPath>/mcp/saia-rag`, so this server
// answers exactly that shape:
//
//   GET  /mcp/saia-rag/health   {"status":"alive"} — the availability probe
//   POST /mcp/saia-rag/mcp      MCP streamable HTTP, answered as plain JSON
//   GET  /mcp/saia-rag/mcp      405: this server offers no standalone SSE stream
//   DELETE /mcp/saia-rag/mcp    405: no session to terminate
//
// The MCP session is stateless on purpose (no `mcp-session-id`), so a restart of
// the app or a second client never hits the service's stale-session repair.
//
// `/__calls` is the control endpoint the scenarios assert against:
//
//   GET    /__calls            every tool call made so far, oldest first
//   DELETE /__calls            forget them (a scenario starts from a clean log)
//
// The data is the one collection `demo/papers`: three indexed files, two tags
// (`finance`, `hr`) and `budget-summary.md` carrying both, so an AND filter and
// a single-tag filter can be told apart.
//
// Keep the collection in step with `tests/arcana-tags.spec.ts` and with the
// `arcana_shares` entry the chat link writes (`demo/papers`).
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_RAG_PORT ?? 8096);
const BASE = "/mcp/saia-rag";

/** One file per row, keyed by name so a tag write lands on the same object. */
const files = () =>
  new Map(
    [
      {
        name: "quarterly-report.pdf",
        size: 48211,
        status: "indexed",
        chunks: 12,
        markdown: true,
        tags: ["finance"],
        text:
          "Quarterly report\n[Page 1]: Revenue rose to 4.1M EUR.\n[Page 2]: The finance team kept the budget at 2.4M EUR.",
        excerpt: {
          1: "Revenue rose to 4.1M EUR in the third quarter.",
          2: "The finance team kept the operating budget at 2.4M EUR.",
        },
      },
      {
        name: "handbook.md",
        size: 2048,
        status: "indexed",
        chunks: 4,
        markdown: false,
        tags: ["hr"],
        text:
          "# Handbook\n\nEvery new colleague gets a mentor for the first three months.\n",
        excerpt: { 0: "Every new colleague gets a mentor for the first three months." },
      },
      {
        name: "budget-summary.md",
        size: 1024,
        status: "indexed",
        chunks: 3,
        markdown: false,
        tags: ["finance", "hr"],
        text:
          "# Budget summary\n\nThe regional offices share a training budget of 180k EUR.\n",
        excerpt: { 0: "The regional offices share a training budget of 180k EUR." },
      },
    ].map((file) => [file.name, file]),
  );

const state = {
  files: files(),
  publicRead: true,
  description: "Quarterly reports and the staff handbook.",
  calls: [],
};

const collection = () => {
  const all = [...state.files.values()];
  const tags = new Map();
  for (const file of all) {
    for (const tag of file.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  return {
    name: "papers",
    collection: "demo/papers",
    owner: "demo",
    role: "owner",
    can_write: true,
    can_manage: true,
    shared: false,
    public: state.publicRead,
    description: state.description,
    tags: [...tags.entries()].map(([name, count]) => ({ name, count })),
    files: all,
  };
};

/** The AND over a requested tag list, as the service applies it. */
const tagged = (wanted) => {
  const filter = Array.isArray(wanted)
    ? wanted.map((tag) => String(tag ?? "").trim()).filter(Boolean)
    : [];
  const all = [...state.files.values()];
  return filter.length
    ? all.filter((file) => filter.every((tag) => file.tags.includes(tag)))
    : all;
};

const NO_RESULTS = "No results found.";

const fileRow = (file, includeTags) => ({
  name: file.name,
  size: file.size,
  status: file.status,
  chunks: file.chunks,
  markdown: file.markdown,
  ...(includeTags ? { tags: file.tags } : {}),
});

const argsOf = (request) => {
  const args = request?.params?.arguments;
  return args && typeof args === "object" ? args : {};
};

/**
 * The tools this stand-in offers. `tags` and `include_tags` are in the schema
 * exactly like the real service's, because the chat tools send a filter only
 * where the advertised schema has the field (`AGENTS.md` §4.36).
 */
const TOOLS = [
  {
    name: "list_collections",
    description: "List the collections this user can read.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_files",
    description: "List a collection's files, optionally only those carrying all tags.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        include_tags: { type: "boolean" },
      },
      required: ["collection"],
    },
  },
  {
    name: "list_tags",
    description: "Every tag of a collection and how many files carry it.",
    inputSchema: {
      type: "object",
      properties: { collection: { type: "string" } },
      required: ["collection"],
    },
  },
  {
    name: "get_file_tags",
    description: "The tags of one file.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filename: { type: "string" },
      },
      required: ["collection", "filename"],
    },
  },
  {
    name: "set_file_tags",
    description: "Replace a file's tags.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filename: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["collection", "filename", "tags"],
    },
  },
  {
    name: "tag_file",
    description: "Add tags to a file.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filename: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["collection", "filename", "tags"],
    },
  },
  {
    name: "search_preview",
    description: "Search a collection and return a preview per document.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        query: { type: "string" },
        count: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["collection", "query"],
    },
  },
  {
    name: "search_documents",
    description: "Search a collection and list the matching documents.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        query: { type: "string" },
        count: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["collection", "query"],
    },
  },
  {
    name: "search_chunks",
    description: "Search a collection and return text passages with their file.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        query: { type: "string" },
        count: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["collection", "query"],
    },
  },
  {
    name: "get_file",
    description: "The indexed Markdown of a converted document.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filename: { type: "string" },
      },
      required: ["collection", "filename"],
    },
  },
  {
    name: "read_file_base64",
    description: "A file's stored bytes.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filename: { type: "string" },
      },
      required: ["collection", "filename"],
    },
  },
  {
    name: "upload_file_base64",
    description: "Store a file in a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filename: { type: "string" },
        content_base64: { type: "string" },
      },
      required: ["collection", "filename", "content_base64"],
    },
  },
  {
    name: "remove_file",
    description: "Remove a file from a collection.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        filename: { type: "string" },
      },
      required: ["collection", "filename"],
    },
  },
  {
    name: "index_collection",
    description: "Queue conversion and indexing for a collection's stored files.",
    inputSchema: {
      type: "object",
      properties: { collection: { type: "string" } },
      required: ["collection"],
    },
  },
  {
    name: "set_collection_description",
    description: "Store what a collection is for.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        description: { type: "string" },
      },
      required: ["collection", "description"],
    },
  },
  {
    name: "list_members",
    description: "Who can open a collection, and with which role.",
    inputSchema: {
      type: "object",
      properties: { collection: { type: "string" } },
      required: ["collection"],
    },
  },
  {
    name: "set_public_read",
    description: "Make a collection readable by every signed-in user.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        public: { type: "boolean" },
      },
      required: ["collection", "public"],
    },
  },
];

/** The text a tool answers with; the MCP result wraps it as one text part. */
function runTool(name, args) {
  switch (name) {
    case "list_collections":
      return {
        collections: [
          {
            name: "papers",
            collection: "demo/papers",
            owner: "demo",
            role: "owner",
            can_write: true,
            can_manage: true,
            shared: false,
            public: state.publicRead,
            description: state.description,
          },
        ],
      };

    case "list_files":
      return {
        files: tagged(args.tags).map((file) =>
          fileRow(file, args.include_tags !== false),
        ),
      };

    case "list_tags": {
      const rows = collection().tags;
      return rows.length
        ? rows.map((tag) => `${tag.name} (${tag.count})`).join("\n")
        : "No tags in this collection.";
    }

    case "get_file_tags": {
      const file = state.files.get(String(args.filename ?? ""));
      if (!file) return `File '${args.filename}' not found`;
      return file.tags.length ? file.tags.join(", ") : "No tags";
    }

    case "set_file_tags":
    case "tag_file": {
      const file = state.files.get(String(args.filename ?? ""));
      if (!file) return `File '${args.filename}' not found`;
      const wanted = Array.isArray(args.tags)
        ? args.tags.map((tag) => String(tag ?? "").trim()).filter(Boolean)
        : [];
      file.tags =
        name === "tag_file"
          ? [...new Set([...file.tags, ...wanted])]
          : [...new Set(wanted)];
      return name === "tag_file"
        ? `Tags for ${file.name}: ${file.tags.join(", ") || "no tags"}`
        : { tags: file.tags };
    }

    case "search_preview":
    case "search_documents":
    case "search_chunks": {
      const hits = tagged(args.tags);
      if (!hits.length) return NO_RESULTS;
      const limit = Number(args.count) > 0 ? Number(args.count) : 5;
      if (name === "search_documents") {
        return hits
          .slice(0, limit)
          .map(
            (file, index) =>
              `${index + 1}. ${file.name} (score=${(0.9 - index * 0.1).toFixed(2)})`,
          )
          .join("\n");
      }
      if (name === "search_chunks") {
        return hits
          .slice(0, limit)
          .map(
            (file, index) =>
              `[${file.name} score=${(0.9 - index * 0.1).toFixed(2)}]\n` +
              (file.excerpt[1] ?? file.excerpt[0] ?? file.text),
          )
          .join("\n\n");
      }
      return hits
        .slice(0, limit)
        .map(
          (file, index) =>
            `${index + 1}. ${file.name} (score=${(0.9 - index * 0.1).toFixed(2)})\n` +
            (file.excerpt[0] ?? file.text),
        )
        .join("\n\n");
    }

    case "get_file": {
      const wanted = String(args.filename ?? "");
      const page = /@(\d+)-(\d+)$/.exec(wanted);
      const file = state.files.get(page ? wanted.slice(0, page.index) : wanted);
      if (!file) return `File '${wanted}' not found`;
      if (!page) return file.text;
      const from = Number(page[1]);
      const to = Number(page[2]);
      const lines = [];
      for (let number = from; number <= to; number += 1) {
        if (file.excerpt[number]) {
          lines.push(`[Page ${number}]: ${file.excerpt[number]}`);
        }
      }
      return lines.length ? lines.join("\n") : file.text;
    }

    case "read_file_base64": {
      const file = state.files.get(String(args.filename ?? ""));
      if (!file) return `File '${args.filename}' not found`;
      return { content_base64: Buffer.from(file.text, "utf8").toString("base64") };
    }

    case "upload_file_base64": {
      const wanted = String(args.filename ?? "").trim();
      if (!wanted) return "A file name is required.";
      const text = Buffer.from(String(args.content_base64 ?? ""), "base64").toString("utf8");
      state.files.set(wanted, {
        name: wanted,
        size: Buffer.byteLength(text),
        status: "stored",
        chunks: 0,
        markdown: false,
        tags: [],
        text,
        excerpt: { 0: text.slice(0, 200) },
      });
      return `Stored ${wanted}`;
    }

    case "remove_file": {
      const wanted = String(args.filename ?? "");
      if (!state.files.delete(wanted)) return `File '${wanted}' not found`;
      return `Removed ${wanted}`;
    }

    case "index_collection":
      for (const file of state.files.values()) file.status = "indexed";
      return "Indexing finished.";

    case "set_collection_description":
      state.description = String(args.description ?? "").trim();
      return "Description saved.";

    case "list_members":
      return { members: [{ user: "demo", role: "owner", kind: "user" }] };

    case "set_public_read":
      state.publicRead = args.public === true;
      return state.publicRead
        ? "The collection is publicly readable."
        : "The collection is no longer publicly readable.";

    default:
      return `Unknown tool: ${name}`;
  }
}

const json = (res, status, body, extraHeaders = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
};

const cors = (res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "access-control-allow-headers",
    "content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id, authorization",
  );
  res.setHeader("access-control-expose-headers", "mcp-session-id");
  res.setHeader("access-control-max-age", "600");
};

/** One JSON-RPC message; notifications have no id and answer 202. */
function handleMessage(message) {
  const { id, method } = message ?? {};

  if (id === undefined || id === null) {
    // `notifications/initialized` and friends: accepted, nothing to answer.
    return { status: 202 };
  }

  switch (method) {
    case "initialize":
      return {
        result: {
          protocolVersion: message.params?.protocolVersion ?? "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "mock-saia-rag", version: "1.0.0" },
        },
      };
    case "ping":
      return { result: {} };
    case "tools/list":
      return { result: { tools: TOOLS } };
    case "tools/call": {
      const name = String(message.params?.name ?? "");
      const args = argsOf(message);
      state.calls.push({ name, args });
      const value = runTool(name, args);
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return { result: { content: [{ type: "text", text }], isError: false } };
    }
    default:
      return {
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

const server = createServer((req, res) => {
  cors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/__calls") {
    if (req.method === "DELETE") {
      state.calls = [];
      json(res, 200, { calls: [] });
      return;
    }
    json(res, 200, { calls: state.calls });
    return;
  }

  if (url.pathname === "/__reset" && req.method === "POST") {
    state.files = files();
    state.publicRead = true;
    state.description = "Quarterly reports and the staff handbook.";
    state.calls = [];
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === `${BASE}/health`) {
    json(res, 200, { status: "alive" });
    return;
  }

  if (url.pathname !== `${BASE}/mcp`) {
    json(res, 404, { detail: "Not Found" });
    return;
  }

  if (req.method === "GET") {
    // No standalone SSE stream: the SDK treats 405 as "this server does not
    // offer one" and keeps using POST for every request.
    json(res, 405, { detail: "Method Not Allowed" });
    return;
  }

  if (req.method === "DELETE") {
    json(res, 405, { detail: "Method Not Allowed" });
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { detail: "Method Not Allowed" });
    return;
  }

  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    let message;
    try {
      message = JSON.parse(body || "{}");
    } catch {
      json(res, 400, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    const answer = handleMessage(message);
    if (answer.status === 202) {
      res.writeHead(202);
      res.end();
      return;
    }
    json(
      res,
      200,
      {
        jsonrpc: "2.0",
        id: message.id ?? null,
        ...(answer.error ? { error: answer.error } : { result: answer.result }),
      },
      // No `mcp-session-id`: this server keeps no per-session state, and the
      // client then never sends a session header that a restart would invalidate.
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`mock saia-rag listening on http://127.0.0.1:${PORT}${BASE}\n`);
});
