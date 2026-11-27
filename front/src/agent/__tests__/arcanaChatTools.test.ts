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
  it("registers the discovery tool and the three read tools", () => {
    const { tools } = createArcanaChatTools([ref]);
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_arcanas",
      "search_arcana",
      "list_arcana_documents",
      "read_arcana_document",
    ]);
  });

  it("lists the collections with their descriptions", async () => {
    const { tools } = createArcanaChatTools([
      { ...ref, description: "Peer-reviewed papers" },
      notes,
    ]);
    const result = await toolNamed(tools, "list_arcanas").execute("id", {});
    expect(result.content[0].text).toContain(
      "- alice/papers: Peer-reviewed papers",
    );
    expect(result.content[0].text).toContain(
      "- bob/notes: Meeting minutes and decisions",
    );
    expect(mocks.callTool).not.toHaveBeenCalled();
  });

  it("marks a binding without a description", async () => {
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
