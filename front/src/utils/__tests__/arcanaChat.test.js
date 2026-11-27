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
  ragCollectionDisplayName: (collection) => collection.collection,
}));

const {
  buildArcanaChatSystemPrompt,
  createArcanaChatToolRunner,
  getArcanaChatToolDefinitions,
} = await import("../arcanaChat");

const collection = {
  name: "Test",
  collection: "tester__test",
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

  it("names the fixed collection in the system prompt", () => {
    const prompt = buildArcanaChatSystemPrompt(collection);
    expect(prompt).toContain('"Test"');
    expect(prompt).toContain("role: owner");
    expect(prompt).toContain("upload_attachment");
    expect(buildArcanaChatSystemPrompt({ ...collection, can_write: false })).toContain(
      "read-only",
    );
  });

  it("describes the files with size, status, chunks and tags", async () => {
    const run = createArcanaChatToolRunner({ collection, confirm: vi.fn() });
    const answer = await run("list_files");
    expect(answer).toContain("a.md");
    expect(answer).toContain("2 chunk(s)");
    expect(answer).toContain("tags: alpha");
    expect(answer).toContain("Markdown: report.md");
  });

  it("returns a converted document's Markdown text for read_file", async () => {
    const run = createArcanaChatToolRunner({ collection, confirm: vi.fn() });
    const answer = await run("read_file", { filename: "report.pdf" });
    expect(answer).toContain("indexed Markdown");
    expect(answer).toContain("# a");
  });

  it("refuses to write without a confirmation and changes nothing", async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    const run = createArcanaChatToolRunner({ collection, confirm });
    const answer = await run("write_text_file", {
      filename: "note.md",
      content: "hello",
    });
    expect(confirm).toHaveBeenCalled();
    expect(answer).toContain("cancelled");
    expect(mocks.provider.write).not.toHaveBeenCalled();
  });

  it("writes the file after the user confirms and reports the change", async () => {
    const onChange = vi.fn();
    const confirm = vi.fn().mockResolvedValue(true);
    const run = createArcanaChatToolRunner({ collection, confirm, onChange });
    const answer = await run("write_text_file", {
      filename: "note.md",
      content: "hello",
    });
    expect(mocks.provider.write).toHaveBeenCalledTimes(1);
    const [path, , options] = mocks.provider.write.mock.calls[0];
    expect(path).toBe("/tester__test/note.md");
    expect(options.overwrite).toBe(true);
    expect(onChange).toHaveBeenCalled();
    expect(answer).toContain("note.md");
  });

  it("uploads an attached file only through the confirmation", async () => {
    const file = new File(["body"], "notes.md", { type: "text/markdown" });
    const confirm = vi.fn().mockResolvedValue(true);
    const run = createArcanaChatToolRunner({
      collection,
      confirm,
      attachments: [{ fileId: "f1", name: "notes.md", file }],
    });
    const answer = await run("upload_attachment", { filename: "notes.md" });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(mocks.provider.uploadFile).toHaveBeenCalledWith(
      "tester__test",
      file,
    );
    expect(answer).toContain("Stored");
  });

  it("treats a dismissed confirmation as cancelled for an upload", async () => {
    const file = new File(["body"], "notes.md", { type: "text/markdown" });
    const run = createArcanaChatToolRunner({
      collection,
      confirm: vi.fn().mockResolvedValue(false),
      attachments: [{ fileId: "f1", name: "notes.md", file }],
    });
    const answer = await run("upload_attachment", {});
    expect(answer).toContain("cancelled");
    expect(mocks.provider.uploadFile).not.toHaveBeenCalled();
  });

  it("refuses to write when the collection is read-only", async () => {
    const run = createArcanaChatToolRunner({
      collection: { ...collection, can_write: false },
      confirm: vi.fn().mockResolvedValue(true),
    });
    await expect(
      run("delete_file", { filename: "a.md" }),
    ).rejects.toThrow("read-only");
    expect(mocks.provider.removeFile).not.toHaveBeenCalled();
  });
});
