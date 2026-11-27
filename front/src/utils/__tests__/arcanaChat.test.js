import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  provider: {
    listFiles: vi.fn(),
    tryListFiles: vi.fn(),
    downloadFile: vi.fn(),
    search: vi.fn(),
    listMembers: vi.fn(),
    uploadFile: vi.fn(),
    write: vi.fn(),
    removeFile: vi.fn(),
    setFileTags: vi.fn(),
    indexCollection: vi.fn(),
  },
}));

vi.mock("../../workspace/arcanas", () => ({
  arcanasProvider: () => mocks.provider,
  arcanaFailureReason: (status) =>
    status.startsWith("Failed:") ? status.slice(7).trim() : null,
  classifyArcanaFiles: (files) =>
    files.length === 0
      ? "current"
      : files.every((file) => file.status === "indexed")
        ? "current"
        : files.some((file) => file.status === "indexed")
          ? "partial"
          : "pending",
  isArcanaIndexed: (status) => status === "indexed",
}));

vi.mock("../../workspace/providers/saiaRag", () => ({
  isTextFileName: (name) => /\.(md|txt)$/i.test(name),
  markdownFileName: (name) => `${name.replace(/\.[^.]+$/, "")}.md`,
  // The real rule: an own collection uses its name, a shared one its storage
  // segment. A proposal names neither; it carries the reference below.
  ragCollectionDisplayName: (collection) =>
    collection.shared ? `${collection.owner}__${collection.name}` : collection.name,
}));

const {
  buildArcanaChatSystemPrompt,
  createArcanaChatToolRunner,
  getArcanaChatToolDefinitions,
} = await import("../arcanaChat");
const { appendArcanaActionMarkers, getArcanaActionProposals } = await import(
  "../arcanaActions"
);

const collection = {
  name: "Test",
  collection: "tester/test",
  owner: "tester",
  role: "owner",
  can_write: true,
  can_manage: true,
  shared: false,
};

const rows = [
  {
    name: "a.md",
    status: "indexed",
    chunks: 2,
    tags: ["alpha"],
    markdown: false,
  },
  {
    name: "report.pdf",
    status: "indexed",
    chunks: 4,
    tags: [],
    markdown: true,
  },
];

const namesOf = (definitions) =>
  definitions.map((definition) => definition.function.name);

beforeEach(() => {
  for (const fn of Object.values(mocks.provider)) fn.mockReset();
  mocks.provider.listFiles.mockResolvedValue(rows);
  mocks.provider.search.mockResolvedValue({ results: [], raw: "" });
  mocks.provider.listMembers.mockResolvedValue([]);
  mocks.provider.downloadFile.mockResolvedValue({
    name: "a.md",
    blob: new Blob(["# a"]),
  });
  mocks.provider.indexCollection.mockResolvedValue("job-1");
});

describe("arcana chat tools", () => {
  it("offers no write tools on a read-only collection", () => {
    const readOnly = namesOf(
      getArcanaChatToolDefinitions({ ...collection, can_write: false }),
    );
    expect(readOnly).toEqual([
      "list_files",
      "read_file",
      "search",
      "get_index_status",
      "list_members",
    ]);
    expect(readOnly).not.toContain("upload_attachment");
  });

  it("tells the model that writes are only proposed", () => {
    const prompt = buildArcanaChatSystemPrompt(collection);
    expect(prompt).toContain('"Test"');
    expect(prompt).toContain("role: owner");
    expect(prompt).toContain("upload_attachment");
    expect(prompt).toContain("approval card");
    expect(prompt).toContain("do not write anything");
    expect(buildArcanaChatSystemPrompt({ ...collection, can_write: false })).toContain(
      "read-only",
    );
  });

  it("describes the files with size, status, chunks and tags", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    const answer = await runner.run("list_files");
    expect(answer).toContain("a.md");
    expect(answer).toContain("2 chunk(s)");
    expect(answer).toContain("tags: alpha");
    expect(answer).toContain("Markdown: report.md");
  });

  it("returns a converted document's Markdown text for read_file", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    const answer = await runner.run("read_file", { filename: "report.pdf" });
    expect(answer).toContain("indexed Markdown");
    expect(answer).toContain("# a");
  });

  it("proposes a new text file and writes nothing", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    const answer = await runner.run("write_text_file", {
      filename: "note.md",
      content: "hello",
    });

    expect(mocks.provider.write).not.toHaveBeenCalled();
    expect(answer).toContain("Proposed");
    expect(answer).toContain("Nothing has been written");

    expect(runner.takeProposals()).toEqual([
      {
        op: "write_text_file",
        collection: "tester/test",
        filename: "note.md",
        content: "hello",
        size: 5,
        existed: false,
        previousText: null,
      },
    ]);
    // The list is reset, so a repeated call is proposed once.
    expect(runner.takeProposals()).toEqual([]);
  });

  it("marks a proposal with the reference the chat page checks", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    await runner.run("set_file_tags", {
      filename: "a.md",
      tags: ["Wasser", "Schuhe"],
    });

    // The provider's calls take the display segment...
    expect(mocks.provider.listFiles).toHaveBeenCalledWith("Test", {
      includeTags: true,
    });

    // ...while the marker names the reference, which is what the chat's id
    // carries and the page compares before rendering the approval card.
    const text = appendArcanaActionMarkers(
      "Vorgeschlagen.",
      runner.takeProposals(),
    );
    const actions = getArcanaActionProposals(text, collection.collection);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      op: "set_file_tags",
      collection: "tester/test",
      filename: "a.md",
      tags: ["Wasser", "Schuhe"],
    });
  });

  it("captures the text an overwrite would have to restore", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    await runner.run("write_text_file", {
      filename: "a.md",
      content: "replaced",
    });

    const [action] = runner.takeProposals();
    expect(action.existed).toBe(true);
    expect(action.previousText).toBe("# a");
  });

  it("cannot restore an overwritten converted document", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    await runner.run("write_text_file", {
      filename: "report.pdf",
      content: "replaced",
    });

    const [action] = runner.takeProposals();
    expect(action.existed).toBe(true);
    expect(action.previousText).toBeNull();
  });

  it("proposes a deletion with the text that can restore a text file", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    const answer = await runner.run("delete_file", { filename: "a.md" });

    expect(mocks.provider.removeFile).not.toHaveBeenCalled();
    expect(answer).toContain("delete");
    const [action] = runner.takeProposals();
    expect(action).toMatchObject({
      op: "delete_file",
      filename: "a.md",
      restoreText: "# a",
    });
  });

  it("cannot restore a deleted binary document", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    await runner.run("delete_file", { filename: "report.pdf" });

    const [action] = runner.takeProposals();
    expect(action.restoreText).toBeNull();
  });

  it("proposes tags with the list that can restore them", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    const answer = await runner.run("set_file_tags", {
      filename: "a.md",
      tags: [" beta ", ""],
    });

    expect(mocks.provider.setFileTags).not.toHaveBeenCalled();
    expect(answer).toContain("beta");
    const [action] = runner.takeProposals();
    expect(action).toMatchObject({
      op: "set_file_tags",
      filename: "a.md",
      tags: ["beta"],
      previousTags: ["alpha"],
    });
  });

  it("proposes an upload without reading or writing the file", async () => {
    const file = new File(["body"], "notes.md", { type: "text/markdown" });
    const runner = createArcanaChatToolRunner({
      collection,
      attachments: [{ fileId: "f1", name: "notes.md", file }],
    });
    const answer = await runner.run("upload_attachment", {
      filename: "notes.md",
    });

    expect(mocks.provider.uploadFile).not.toHaveBeenCalled();
    expect(answer).toContain("store");
    expect(runner.takeProposals()).toEqual([
      {
        op: "upload_attachment",
        collection: "tester/test",
        filename: "notes.md",
        fileId: "f1",
        size: 4,
        existed: false,
      },
    ]);
  });

  it("marks an upload over an existing file as an overwrite", async () => {
    const file = new File(["body"], "a.md", { type: "text/markdown" });
    const runner = createArcanaChatToolRunner({
      collection,
      attachments: [{ fileId: "f2", name: "a.md", file }],
    });
    await runner.run("upload_attachment", {});

    const [action] = runner.takeProposals();
    expect(action.existed).toBe(true);
  });

  it("proposes indexing without starting it", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    await runner.run("start_index");

    expect(mocks.provider.indexCollection).not.toHaveBeenCalled();
    expect(runner.takeProposals()).toEqual([
      { op: "start_index", collection: "tester/test" },
    ]);
  });

  it("reports a missing file instead of proposing a deletion", async () => {
    const runner = createArcanaChatToolRunner({ collection });
    const answer = await runner.run("delete_file", { filename: "missing.md" });

    expect(answer).toContain("nothing to delete");
    expect(runner.takeProposals()).toEqual([]);
  });

  it("refuses to propose a write when the collection is read-only", async () => {
    const runner = createArcanaChatToolRunner({
      collection: { ...collection, can_write: false },
    });
    await expect(
      runner.run("delete_file", { filename: "a.md" }),
    ).rejects.toThrow("read-only");
    expect(runner.takeProposals()).toEqual([]);
  });
});
