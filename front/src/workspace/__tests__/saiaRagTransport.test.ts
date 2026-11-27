import http from "node:http";
import { File as NodeFile } from "node:buffer";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { SaiaRagProvider } from "../providers/saiaRag";

/**
 * The provider over a real streamable-HTTP MCP session.
 *
 * `saiaRagProvider.test.ts` mocks the SDK client, so it proves the chunk loop
 * but not the wire: a real upload is a sequence of POSTs that each carry ~1.4
 * MiB of base64 over the transport. This server implements the four tools the
 * provider needs plus `upload_file_chunk` with the service's staging rules, so
 * a regression in either side of that sequence fails here.
 */

const COLLECTION = {
  name: "demo",
  collection: "alice__demo",
  owner: "alice",
  role: "owner",
  can_write: true,
  can_manage: true,
  shared: false,
};

type Call = { name: string; args: Record<string, unknown> };

const calls: Call[] = [];
/** Bytes per HTTP request body, to prove a chunk fits the service's 4 MiB cap. */
const bodySizes: number[] = [];
/** Staged bytes per `${collection}\0${filename}`, as `upload_file_chunk` keeps them. */
const staged = new Map<string, Uint8Array>();
const stored = new Map<string, Uint8Array>();

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});
const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
});

const stageKey = (collection: string, filename: string) =>
  `${collection}\0${filename}`;

const writeStaged = (collection: string, filename: string, data: Uint8Array) => {
  staged.delete(stageKey(collection, filename));
  stored.set(stageKey(collection, filename), data);
};

/** One server per MCP session, like the service's session manager. */
const createServer = () => {
  const server = new McpServer({ name: "saia-rag-test", version: "1.0.0" });

  server.tool("list_collections", "collections", {}, async () => {
    calls.push({ name: "list_collections", args: {} });
    return json({ collections: [COLLECTION] });
  });

  server.tool(
    "list_files",
    "files",
    { collection: z.string(), include_tags: z.boolean().optional() },
    async ({ collection }) => {
      calls.push({ name: "list_files", args: { collection } });
      const files = [...stored.keys()]
        .filter((key) => key.startsWith(`${collection}\0`))
        .map((key) => {
          const name = key.split("\0")[1];
          return {
            name,
            size: stored.get(key)?.byteLength ?? 0,
            status: "stored",
            chunks: 0,
            tags: [],
          };
        });
      return json({ collection, files });
    },
  );

  server.tool(
    "read_file_base64",
    "read",
    { collection: z.string(), filename: z.string() },
    async ({ collection, filename }) => {
      calls.push({ name: "read_file_base64", args: { collection, filename } });
      const data = stored.get(stageKey(collection, filename));
      if (!data) throw new Error(`File '${filename}' is not in this collection.`);
      return json({
        collection,
        filename,
        size: data.byteLength,
        content_base64: Buffer.from(data).toString("base64"),
      });
    },
  );

  server.tool(
    "upload_file_base64",
    "store",
    { collection: z.string(), filename: z.string(), content_base64: z.string() },
    async ({ collection, filename, content_base64 }) => {
      calls.push({ name: "upload_file_base64", args: { collection, filename } });
      const data = Uint8Array.from(Buffer.from(content_base64, "base64"));
      writeStaged(collection, filename, data);
      return text(`Stored '${filename}' (${data.byteLength} bytes)`);
    },
  );

  server.tool(
    "upload_file_chunk",
    "store a chunk",
    {
      collection: z.string(),
      filename: z.string(),
      chunk_base64: z.string(),
      offset: z.number(),
      last: z.boolean(),
    },
    async ({ collection, filename, chunk_base64, offset, last }) => {
      calls.push({
        name: "upload_file_chunk",
        args: { collection, filename, offset, last },
      });
      const chunk = Uint8Array.from(Buffer.from(chunk_base64, "base64"));
      // The service's transport caps the whole request body at 4 MiB, which is
      // why the provider never packs more than ~2.8 MiB of base64 per call.
      if (chunk.byteLength > 3 * 1024 * 1024) {
        throw new Error(`chunk is ${chunk.byteLength} bytes`);
      }
      const key = stageKey(collection, filename);
      if (offset === 0) {
        staged.set(key, chunk);
      } else {
        const existing = staged.get(key);
        if (!existing) {
          throw new Error(`no upload is in progress at offset ${offset}`);
        }
        if (existing.byteLength !== offset) {
          throw new Error(
            `chunk offset ${offset} does not match ${existing.byteLength}`,
          );
        }
        const next = new Uint8Array(existing.byteLength + chunk.byteLength);
        next.set(existing, 0);
        next.set(chunk, existing.byteLength);
        staged.set(key, next);
      }
      if (!last) return json({ status: "partial" });
      const data = staged.get(key) ?? new Uint8Array();
      writeStaged(collection, filename, data);
      return text(`Stored '${filename}' (${data.byteLength} bytes)`);
    },
  );

  return server;
};

let httpServer: http.Server | null = null;
let baseUrl = "";

beforeEach(async () => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => "test-session",
  });
  await createServer().connect(transport);
  const server = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    bodySizes.push(Buffer.byteLength(body));
    await transport.handleRequest(
      request,
      response,
      body ? JSON.parse(body) : undefined,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  httpServer = server;
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/mcp`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
  httpServer = null;
  calls.length = 0;
  bodySizes.length = 0;
  staged.clear();
  stored.clear();
});

describe("SaiaRagProvider over a real MCP transport", () => {
  it("uploads a file larger than one chunk and stores the exact bytes", async () => {
    const provider = new SaiaRagProvider("real-transport", baseUrl);
    const bytes = new Uint8Array(4 * 1024 * 1024 + 12345);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 31 + 7) % 256;
    }
    // jsdom's File has no stream(); Node's Blob/File does, and the provider
    // only needs the browser shape (name, size, stream()).
    const file = new NodeFile([bytes], "notes.pdf", { type: "application/pdf" });

    try {
      await provider.uploadFile("demo", file);
    } finally {
      provider.close();
    }

    const chunks = calls.filter((call) => call.name === "upload_file_chunk");
    expect(chunks.map((call) => call.args.offset)).toEqual([
      0,
      1024 * 1024,
      2 * 1024 * 1024,
      3 * 1024 * 1024,
      4 * 1024 * 1024,
    ]);
    expect(chunks.map((call) => call.args.last)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(stored.get(stageKey("alice__demo", "notes.pdf"))).toEqual(bytes);
    // Base64 and the JSON envelope still keep every request under the 4 MiB
    // body limit the MCP server enforces.
    expect(Math.max(...bodySizes)).toBeLessThan(4 * 1024 * 1024);
  }, 60_000);

  it("stores a single-chunk stream and reports its size", async () => {
    const provider = new SaiaRagProvider("real-transport", baseUrl);
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    let entry: { size?: number } | undefined;
    try {
      entry = await provider.write(
        "/demo/tiny.bin",
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        { size: bytes.byteLength, overwrite: true },
      );
    } finally {
      provider.close();
    }
    expect(entry?.size).toBe(bytes.byteLength);
    expect(stored.get(stageKey("alice__demo", "tiny.bin"))).toEqual(bytes);
  }, 60_000);
});
