import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyArcanaActions,
  revertArcanaActions,
} from "../arcanaActionApply";

const mocks = vi.hoisted(() => ({
  provider: {
    listCollections: vi.fn(),
    listFiles: vi.fn(),
    uploadFile: vi.fn(),
    write: vi.fn(),
    removeFile: vi.fn(),
    setFileTags: vi.fn(),
    indexCollection: vi.fn(),
  },
  loadFile: vi.fn(),
}));

vi.mock("../../db", () => ({
  loadFile: mocks.loadFile,
}));

vi.mock("../../workspace/arcanas", () => ({
  arcanasProvider: () => mocks.provider,
  ARCANA_FILES_CHANGED_EVENT: "chatai:arcana-files-changed",
  arcanaDisplayName: (entry) =>
    entry.shared ? `${entry.owner}__${entry.name}` : entry.name,
}));

// The proposal names the collection's reference; the provider takes the
// display segment (`name`, or `owner__name` for a shared collection).
const collection = "tester/test";
const display = "test";

const base = { collection };

const file = new File(["body"], "note.md", { type: "text/markdown" });

beforeEach(() => {
  for (const fn of Object.values(mocks.provider)) fn.mockReset();
  mocks.loadFile.mockReset().mockResolvedValue(file);
  mocks.provider.listCollections.mockResolvedValue([
    { name: display, collection, owner: "tester", shared: false },
  ]);
  mocks.provider.listFiles.mockResolvedValue([
    { name: "old.md" },
    { name: "new.md" },
    { name: "a.md" },
  ]);
  mocks.provider.indexCollection.mockResolvedValue("job-1");
});

describe("applyArcanaActions", () => {
  it("uploads the attachment the proposal pointed at", async () => {
    const result = await applyArcanaActions([
      {
        ...base,
        op: "upload_attachment",
        filename: "note.md",
        fileId: "f1",
        size: 4,
        existed: false,
      },
    ]);

    expect(mocks.loadFile).toHaveBeenCalledWith("f1");
    expect(mocks.provider.uploadFile).toHaveBeenCalledWith(display, file);
    expect(result.failures).toEqual([]);
  });

  it("writes, deletes, indexes and retags through the provider", async () => {
    await applyArcanaActions([
      {
        ...base,
        op: "write_text_file",
        filename: "note.md",
        content: "hello",
      },
      { ...base, op: "delete_file", filename: "old.md" },
      { ...base, op: "start_index" },
      {
        ...base,
        op: "set_file_tags",
        filename: "a.md",
        tags: ["beta"],
        previousTags: ["alpha"],
      },
    ]);

    expect(mocks.provider.write).toHaveBeenCalledTimes(1);
    const [path, , options] = mocks.provider.write.mock.calls[0];
    expect(path).toBe(`/${display}/note.md`);
    expect(options.overwrite).toBe(true);
    expect(mocks.provider.removeFile).toHaveBeenCalledWith(display, "old.md");
    expect(mocks.provider.indexCollection).toHaveBeenCalledWith(display);
    expect(mocks.provider.setFileTags).toHaveBeenCalledWith(
      display,
      "a.md",
      ["beta"],
    );
  });

  it("reports one failure without dropping the rest of the batch", async () => {
    mocks.provider.removeFile.mockRejectedValue(new Error("service down"));

    const result = await applyArcanaActions([
      { ...base, op: "delete_file", filename: "old.md" },
      {
        ...base,
        op: "set_file_tags",
        filename: "a.md",
        tags: ["beta"],
        previousTags: [],
      },
    ]);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toContain("service down");
    expect(result.applied).toEqual(["set_file_tags:a.md:beta"]);
    expect(mocks.provider.setFileTags).toHaveBeenCalled();
  });

  it("treats a repeated delete as already done", async () => {
    const result = await applyArcanaActions([
      { ...base, op: "delete_file", filename: "gone.md" },
    ]);

    expect(mocks.provider.removeFile).not.toHaveBeenCalled();
    expect(result.failures).toEqual([]);
  });

  it("announces the collection once per applied batch", async () => {
    const listener = vi.fn();
    window.addEventListener("chatai:arcana-files-changed", listener);

    await applyArcanaActions([
      {
        ...base,
        op: "write_text_file",
        filename: "a.md",
        content: "one",
      },
      {
        ...base,
        op: "write_text_file",
        filename: "b.md",
        content: "two",
      },
    ]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.collection).toBe(collection);
    window.removeEventListener("chatai:arcana-files-changed", listener);
  });

  it("addresses a shared collection by its display segment", async () => {
    // The proposal's reference is `bob/papers`; the provider's calls and paths
    // take the storage segment, and the announcement keeps the reference the
    // manager compares with its own collection.
    mocks.provider.listCollections.mockResolvedValue([
      { name: "papers", collection: "bob/papers", owner: "bob", shared: true },
    ]);
    const listener = vi.fn();
    window.addEventListener("chatai:arcana-files-changed", listener);

    await applyArcanaActions([
      {
        collection: "bob/papers",
        op: "set_file_tags",
        filename: "a.md",
        tags: ["beta"],
        previousTags: [],
      },
    ]);

    expect(mocks.provider.setFileTags).toHaveBeenCalledWith(
      "bob__papers",
      "a.md",
      ["beta"],
    );
    expect(listener.mock.calls[0][0].detail.collection).toBe("bob/papers");
    window.removeEventListener("chatai:arcana-files-changed", listener);
  });
});

describe("revertArcanaActions", () => {
  it("restores the previous tags", async () => {
    await revertArcanaActions([
      {
        ...base,
        op: "set_file_tags",
        filename: "a.md",
        tags: ["beta"],
        previousTags: ["alpha"],
      },
    ]);

    expect(mocks.provider.setFileTags).toHaveBeenCalledWith(
      display,
      "a.md",
      ["alpha"],
    );
  });

  it("restores an overwritten text file and removes a newly written one", async () => {
    await revertArcanaActions([
      {
        ...base,
        op: "write_text_file",
        filename: "restored.md",
        content: "new",
        existed: true,
        previousText: "old",
      },
      {
        ...base,
        op: "write_text_file",
        filename: "new.md",
        content: "new",
        existed: false,
        previousText: null,
      },
    ]);

    const paths = mocks.provider.write.mock.calls.map(([path]) => path);
    expect(paths).toEqual([`/${display}/restored.md`]);
    expect(mocks.provider.removeFile).toHaveBeenCalledWith(
      display,
      "new.md",
    );
  });

  it("writes a deleted text file back", async () => {
    await revertArcanaActions([
      {
        ...base,
        op: "delete_file",
        filename: "gone.md",
        restoreText: "contents",
      },
    ]);

    expect(mocks.provider.write).toHaveBeenCalledTimes(1);
  });

  it("undoes the latest change first", async () => {
    await revertArcanaActions([
      {
        ...base,
        op: "set_file_tags",
        filename: "a.md",
        tags: ["first"],
        previousTags: [],
      },
      {
        ...base,
        op: "set_file_tags",
        filename: "b.md",
        tags: ["second"],
        previousTags: [],
      },
    ]);

    expect(
      mocks.provider.setFileTags.mock.calls.map(([, filename]) => filename),
    ).toEqual(["b.md", "a.md"]);
  });

  it("removes an upload only when the file did not exist before", async () => {
    await revertArcanaActions([
      {
        ...base,
        op: "upload_attachment",
        filename: "new.md",
        fileId: "f1",
        existed: false,
      },
      {
        ...base,
        op: "upload_attachment",
        filename: "old.md",
        fileId: "f2",
        existed: true,
      },
    ]);

    expect(mocks.provider.removeFile).toHaveBeenCalledTimes(1);
    expect(mocks.provider.removeFile).toHaveBeenCalledWith(
      display,
      "new.md",
    );
  });
});
