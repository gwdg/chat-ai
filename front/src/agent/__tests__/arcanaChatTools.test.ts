import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  closeQuietly: vi.fn(),
  callTool: vi.fn(),
}));

vi.mock("../../apis/saiaRag", () => ({
  openSaiaRagClient: mocks.open,
  closeQuietly: mocks.closeQuietly,
  readToolResult: (result: any) => ({
    text: Array.isArray(result?.content)
      ? result.content.map((part: any) => part?.text ?? "").join("")
      : String(result?.content ?? ""),
    isError: result?.isError === true,
  }),
}));

vi.mock("../../workspace/providers/saiaRag", () => ({
  isTextFileName: (name: string) => /\.[a-z0-9]+$/i.test(name) && !/\.pdf$/i.test(name),
  // The real parser accepts the optional `p.N` a page-aware service reports.
  parseSearchResults: (value: string) =>
    String(value)
      .split(/\n{2,}(?=\[)/)
      .map((block) => {
        const match = block.match(
          /^\[(.*?)(?: p\.(\d+))? score=([\d.]+)\]\s*\n?([\s\S]*)$/,
        );
        if (!match) return { filename: "", text: block.trim() };
        return {
          filename: match[1],
          ...(match[2] ? { page: Number(match[2]) } : {}),
          score: Number(match[3]),
          text: match[4].trim(),
        };
      })
      .filter((row: any) => row.text),
}));

import { createArcanaChatTools } from "../arcanaChatTools";

const ref = { collection: "alice/papers", owner: "alice", name: "papers" };
const notes = {
  collection: "bob/notes",
  owner: "bob",
  name: "notes",
  description: "Meeting minutes and decisions",
};

const answer = (text: string) => ({ content: [{ type: "text", text }] });
const failure = (text: string) => ({ content: [{ type: "text", text }], isError: true });

const toolNamed = (tools: any[], name: string) => {
  const found = tools.find((tool) => tool.name === name);
  if (!found) throw new Error(`${name} is not registered`);
  return found;
};

beforeEach(() => {
  mocks.open.mockReset();
  mocks.closeQuietly.mockReset();
  mocks.callTool.mockReset();
  mocks.open.mockResolvedValue({ callTool: mocks.callTool });
});

describe("Arcana chat tools", () => {
  it("registers the discovery tools and the four read tools", () => {
    const { tools } = createArcanaChatTools([ref]);
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_arcanas",
      "arcana_details",
      "search_arcana",
      "list_arcana_documents",
      "read_arcana_document",
      "retrieve_document",
    ]);
  });

  it("lists the collections with the descriptions stored on the service", async () => {
    // The description belongs to the collection, so `list_collections` is what
    // the model has to see — including for a collection whose chat-local copy
    // is stale.
    mocks.callTool.mockResolvedValue(
      answer(
        JSON.stringify({
          collections: [
            {
              collection: "alice__papers",
              name: "papers",
              description: "Peer-reviewed papers on retrieval",
            },
            {
              collection: "bob__notes",
              name: "notes",
              description: "Meeting minutes and decisions",
            },
          ],
        }),
      ),
    );
    const { tools } = createArcanaChatTools([
      { ...ref, description: "An older local copy" },
      notes,
    ]);
    const result = await toolNamed(tools, "list_arcanas").execute("id", {});
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "list_collections",
      arguments: {},
    });
    expect(result.content[0].text).toContain(
      "- alice/papers: Peer-reviewed papers on retrieval",
    );
    expect(result.content[0].text).toContain(
      "- bob/notes: Meeting minutes and decisions",
    );
  });

  it("reports one collection's owner and description", async () => {
    mocks.callTool.mockResolvedValue(
      answer(
        JSON.stringify({
          collections: [
            {
              collection: "alice__papers",
              name: "papers",
              owner: "alice",
              description: "Peer-reviewed papers on retrieval",
            },
          ],
        }),
      ),
    );
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "arcana_details").execute("id", {});
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "list_collections",
      arguments: {},
    });
    expect(result.content[0].text).toContain("Arcana: alice/papers");
    expect(result.content[0].text).toContain("Owner: alice");
    expect(result.content[0].text).toContain(
      "Description: Peer-reviewed papers on retrieval",
    );
  });

  it("answers details from the binding when the service cannot", async () => {
    // The owner and the text are known locally too, so an unreachable service
    // need not turn the collection into an unknown one.
    mocks.callTool.mockRejectedValue(new Error("unreachable"));
    const { tools } = createArcanaChatTools([
      { ...ref, description: "Local text" },
    ]);
    const result = await toolNamed(tools, "arcana_details").execute("id", {});
    expect(result.content[0].text).toContain("Owner: alice");
    expect(result.content[0].text).toContain("Description: Local text");
  });

  it("says so when the collection has no description", async () => {
    mocks.callTool.mockResolvedValue(answer(JSON.stringify({ collections: [] })));
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "arcana_details").execute("id", {});
    expect(result.content[0].text).toContain("Description: (none)");
  });

  it("refuses details for a collection the chat was not given", async () => {
    mocks.callTool.mockResolvedValue(answer(JSON.stringify({ collections: [] })));
    const { tools } = createArcanaChatTools([ref, notes]);
    const result = await toolNamed(tools, "arcana_details").execute("id", {
      collection: "bob/papers",
    });
    expect(result.content[0].text).toContain(
      `"bob/papers" is not one of this chat's Arcana collections`,
    );
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("falls back to a chat-local description when the service has none", async () => {
    // A service older than the description table reports no field at all.
    mocks.callTool.mockResolvedValue(answer(JSON.stringify({ collections: [] })));
    const { tools } = createArcanaChatTools([
      { ...ref, description: "Peer-reviewed papers" },
    ]);
    const result = await toolNamed(tools, "list_arcanas").execute("id", {});
    expect(result.content[0].text).toContain(
      "- alice/papers: Peer-reviewed papers",
    );
  });

  it("still lists the collections when the service cannot answer", async () => {
    mocks.callTool.mockRejectedValue(new Error("unreachable"));
    const { tools } = createArcanaChatTools([{ ...ref, description: "Local" }]);
    const result = await toolNamed(tools, "list_arcanas").execute("id", {});
    expect(result.content[0].text).toContain("- alice/papers: Local");
  });

  it("marks a binding without a description", async () => {
    mocks.callTool.mockResolvedValue(answer(JSON.stringify({ collections: [] })));
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "list_arcanas").execute("id", {});
    expect(result.content[0].text).toContain("- alice/papers: (no description)");
  });

  it("connects lazily, on the first call", async () => {
    const { tools } = createArcanaChatTools([ref]);
    expect(mocks.open).not.toHaveBeenCalled();
    mocks.callTool.mockResolvedValue(answer("no results"));
    await toolNamed(tools, "search_arcana").execute("id", { query: "x" });
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it("searches the bound collection and clamps the count", async () => {
    mocks.callTool.mockResolvedValue(answer("passages"));
    const { tools } = createArcanaChatTools([ref]);

    await expect(
      toolNamed(tools, "search_arcana").execute("id", { query: "  water ", count: 100 }),
    ).resolves.toEqual({ content: [{ type: "text", text: "passages" }], details: undefined });
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "search_chunks",
      arguments: { collection: "alice/papers", query: "water", count: 20 },
    });
  });

  it("uses the default count when none is given", async () => {
    mocks.callTool.mockResolvedValue(answer("passages"));
    const { tools } = createArcanaChatTools([ref]);
    await toolNamed(tools, "search_arcana").execute("id", { query: "water" });
    expect(mocks.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ arguments: expect.objectContaining({ count: 5 }) }),
    );
  });

  it("defaults to the only collection when no collection is given", async () => {
    mocks.callTool.mockResolvedValue(answer("passages"));
    const { tools } = createArcanaChatTools([ref]);
    await toolNamed(tools, "search_arcana").execute("id", { query: "water" });
    expect(mocks.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({ collection: "alice/papers" }),
      }),
    );
  });

  it("accepts either spelling of a collection in a chat with several", async () => {
    mocks.callTool.mockResolvedValue(answer("passages"));
    const { tools } = createArcanaChatTools([ref, notes]);

    await toolNamed(tools, "search_arcana").execute("id", {
      query: "decision",
      collection: "bob/notes",
    });
    expect(mocks.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({ collection: "bob/notes" }),
      }),
    );

    await toolNamed(tools, "search_arcana").execute("id", {
      query: "decision",
      collection: "alice/papers",
    });
    expect(mocks.callTool).toHaveBeenLastCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({ collection: "alice/papers" }),
      }),
    );
  });

  it("asks for a collection when the chat has several and none is given", async () => {
    const { tools } = createArcanaChatTools([ref, notes]);
    const result = await toolNamed(tools, "search_arcana").execute("id", {
      query: "decision",
    });
    expect(result.content[0].text).toContain("A collection is required");
    expect(result.content[0].text).toContain("bob/notes");
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("refuses a collection the chat was not given", async () => {
    const { tools } = createArcanaChatTools([ref, notes]);
    const result = await toolNamed(tools, "list_arcana_documents").execute("id", {
      collection: "eve__secrets",
    });
    expect(result.content[0].text).toContain("is not one of this chat's Arcana collections");
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("refuses an empty search without contacting the service", async () => {
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "search_arcana").execute("id", { query: "  " });
    expect(result.content[0].text).toBe("A query is required.");
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("lists the files of the chosen collection with size and status", async () => {
    mocks.callTool.mockResolvedValue(
      answer(
        JSON.stringify({
          files: [
            { name: "a.md", size: 2048, status: "indexed", chunks: 3 },
            { name: "b.pdf", size: 10, status: "stored" },
          ],
        }),
      ),
    );
    const { tools } = createArcanaChatTools([ref, notes]);
    const result = await toolNamed(tools, "list_arcana_documents").execute("id", {
      collection: "alice/papers",
    });
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "list_files",
      arguments: { collection: "alice/papers" },
    });
    expect(result.content[0].text).toContain("- a.md (2.0 KB, indexed, 3 chunks)");
    expect(result.content[0].text).toContain("- b.pdf (10 B, stored)");
  });

  it("says so when the collection is empty", async () => {
    mocks.callTool.mockResolvedValue(answer(JSON.stringify({ files: [] })));
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "list_arcana_documents").execute("id", {});
    expect(result.content[0].text).toBe('The collection "papers" has no files.');
  });

  it("decodes a text document", async () => {
    mocks.callTool.mockResolvedValue(
      answer(
        JSON.stringify({
          content_base64: Buffer.from("# Hello", "utf8").toString("base64"),
        }),
      ),
    );
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "read_arcana_document").execute("id", {
      filename: "a.md",
    });
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "read_file_base64",
      arguments: { collection: "alice/papers", filename: "a.md" },
    });
    expect(result.content[0].text).toBe("# a.md\n\n# Hello");
  });

  it("refuses a binary document instead of returning its bytes", async () => {
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "read_arcana_document").execute("id", {
      filename: "scan.pdf",
    });
    expect(result.content[0].text).toContain("not a text file");
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("requires a file name", async () => {
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "read_arcana_document").execute("id", {
      filename: " ",
    });
    expect(result.content[0].text).toBe("A file name is required.");
  });

  it("quotes the hit page and the one after it, and records the source", async () => {
    mocks.callTool.mockImplementation(async ({ name, arguments: args }: any) => {
      if (name === "list_files") {
        return answer(
          JSON.stringify({
            files: [{ name: "report.pdf", size: 10, status: "indexed", chunks: 4, markdown: true }],
          }),
        );
      }
      if (name === "get_file") {
        return answer(
          "[Page 7]: #\n\nWater is wet.\n\n[Page 8]: #\n\nStill wet.",
        );
      }
      throw new Error(`unexpected tool ${name}`);
    });

    const { tools, getDocuments } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "retrieve_document").execute("id", {
      filename: "report.pdf",
      page: 7,
    });

    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "get_file",
      arguments: { collection: "alice/papers", filename: "report.pdf@7-8" },
    });
    expect(result.content[0].text).toContain("report.pdf page 7-8");
    expect(result.content[0].text).toContain('Cite "report.pdf", page 7');
    expect(getDocuments()).toEqual([
      {
        collection: "alice/papers",
        filename: "report.pdf",
        page: 7,
        pages: 2,
        excerpt: "[Page 7]: #\n\nWater is wet.\n\n[Page 8]: #\n\nStill wet.",
      },
    ]);
  });

  it("finds the page through a search when none is given", async () => {
    mocks.callTool.mockImplementation(async ({ name }: any) => {
      if (name === "list_files") {
        return answer(
          JSON.stringify({
            files: [{ name: "report.pdf", status: "indexed", chunks: 4, markdown: true }],
          }),
        );
      }
      if (name === "search_chunks") {
        return answer("[report.pdf p.9 score=0.8]\n\nThe passage.\n\n[other.pdf p.2 score=0.4]\n\nElsewhere.");
      }
      if (name === "get_file") {
        return answer("[Page 9]: #\n\nThe passage.");
      }
      throw new Error(`unexpected tool ${name}`);
    });

    const { tools, getDocuments } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "retrieve_document").execute("id", {
      filename: "report.pdf",
      query: "what does the report say",
    });

    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "search_chunks",
      arguments: {
        collection: "alice/papers",
        query: "what does the report say",
        count: 20,
      },
    });
    expect(mocks.callTool).toHaveBeenCalledWith({
      name: "get_file",
      arguments: { collection: "alice/papers", filename: "report.pdf@9-10" },
    });
    expect(result.content[0].text).toContain("page 9");
    expect(getDocuments()[0]).toMatchObject({ page: 9, pages: 1 });
  });

  it("quotes a plain text file without a page", async () => {
    mocks.callTool.mockImplementation(async ({ name }: any) => {
      if (name === "list_files") {
        return answer(
          JSON.stringify({
            files: [{ name: "notes.md", status: "indexed", chunks: 1, markdown: false }],
          }),
        );
      }
      if (name === "read_file_base64") {
        return answer(
          JSON.stringify({
            content_base64: Buffer.from("# Notes\n\nHello", "utf8").toString("base64"),
          }),
        );
      }
      throw new Error(`unexpected tool ${name}`);
    });

    const { tools, getDocuments } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "retrieve_document").execute("id", {
      filename: "notes.md",
    });

    expect(mocks.callTool).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "get_file" }),
    );
    expect(result.content[0].text).toContain("# Notes");
    expect(getDocuments()).toEqual([
      {
        collection: "alice/papers",
        filename: "notes.md",
        pages: 1,
        excerpt: "# Notes\n\nHello",
      },
    ]);
  });

  it("refuses a binary document instead of inventing pages", async () => {
    mocks.callTool.mockResolvedValue(
      answer(
        JSON.stringify({
          files: [{ name: "scan.pdf", status: "stored", chunks: 0, markdown: false }],
        }),
      ),
    );
    const { tools, getDocuments } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "retrieve_document").execute("id", {
      filename: "scan.pdf",
    });
    expect(result.content[0].text).toContain("binary file");
    expect(getDocuments()).toEqual([]);
  });

  it("names the files when a citation names an unknown one", async () => {
    mocks.callTool.mockResolvedValue(
      answer(JSON.stringify({ files: [{ name: "a.md", status: "indexed", markdown: false }] })),
    );
    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "retrieve_document").execute("id", {
      filename: "missing.pdf",
    });
    expect(result.content[0].text).toBe(
      '"missing.pdf" is not in "papers". Use list_arcana_documents for the exact file name.',
    );
  });

  it("lists a cited page once", async () => {
    mocks.callTool.mockImplementation(async ({ name }: any) => {
      if (name === "list_files") {
        return answer(
          JSON.stringify({
            files: [{ name: "report.pdf", status: "indexed", chunks: 4, markdown: true }],
          }),
        );
      }
      return answer("[Page 3]: #\n\nA page.");
    });
    const { tools, getDocuments } = createArcanaChatTools([ref]);
    for (const page of [3, 3]) {
      await toolNamed(tools, "retrieve_document").execute("id", {
        filename: "report.pdf",
        page,
      });
    }
    expect(getDocuments()).toHaveLength(1);
  });

  it("surfaces a service error", async () => {
    mocks.callTool.mockResolvedValue(failure("collection not found"));
    const { tools } = createArcanaChatTools([ref]);
    await expect(
      toolNamed(tools, "search_arcana").execute("id", { query: "x" }),
    ).rejects.toThrow("collection not found");
  });

  it("reconnects once when the session was lost", async () => {
    const second = { callTool: vi.fn().mockResolvedValue(answer("recovered")) };
    mocks.open
      .mockResolvedValueOnce({ callTool: mocks.callTool })
      .mockResolvedValueOnce(second);
    mocks.callTool.mockRejectedValue(new Error("Session not found"));

    const { tools } = createArcanaChatTools([ref]);
    const result = await toolNamed(tools, "search_arcana").execute("id", { query: "x" });

    expect(mocks.open).toHaveBeenCalledTimes(2);
    expect(mocks.closeQuietly).toHaveBeenCalledTimes(1);
    expect(second.callTool).toHaveBeenCalledTimes(1);
    expect(result.content[0].text).toBe("recovered");
  });

  it("does not retry a failure that is not a lost session", async () => {
    mocks.callTool.mockRejectedValue(new Error("fetch failed"));
    const { tools } = createArcanaChatTools([ref]);
    await expect(
      toolNamed(tools, "search_arcana").execute("id", { query: "x" }),
    ).rejects.toThrow("fetch failed");
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it("closes the client when the turn ends and tolerates a second close", async () => {
    mocks.callTool.mockResolvedValue(answer("ok"));
    const { tools, close } = createArcanaChatTools([ref]);
    await toolNamed(tools, "search_arcana").execute("id", { query: "x" });
    close();
    close();
    expect(mocks.closeQuietly).toHaveBeenCalledTimes(2);
  });
});
