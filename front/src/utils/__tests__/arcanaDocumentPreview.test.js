import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  provider: {
    listCollections: vi.fn(),
    listFiles: vi.fn(),
    readOriginalFile: vi.fn(),
  },
}));

vi.mock("../../workspace/arcanas", () => ({
  arcanasProvider: () => mocks.provider,
  arcanaDisplayName: (collection) =>
    collection.shared
      ? `${collection.owner}__${collection.name}`
      : collection.name,
}));

vi.mock("../../workspace/providers/saiaRag", () => ({
  isTextFileName: (name) => /\.(md|txt|csv)$/i.test(name),
}));

import { openArcanaDocumentPreview } from "../arcanaDocumentPreview";

const collection = {
  name: "papers",
  collection: "alice/papers",
  owner: "alice",
  shared: true,
};

const document = {
  collection: "alice/papers",
  filename: "report.pdf",
  page: 7,
  pages: 2,
  excerpt: "[Page 7]: #\n\nPassage.",
};

const blobOf = (text, type = "application/pdf") =>
  new Blob([text], { type });

beforeEach(() => {
  mocks.provider.listCollections.mockReset().mockResolvedValue([collection]);
  mocks.provider.listFiles.mockReset();
  mocks.provider.readOriginalFile.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:document");
  URL.revokeObjectURL = vi.fn();
});

describe("openArcanaDocumentPreview", () => {
  it("opens the original PDF at the cited page, not its indexed Markdown", async () => {
    mocks.provider.listFiles.mockResolvedValue([
      { name: "report.pdf", markdown: true },
    ]);
    mocks.provider.readOriginalFile.mockResolvedValue({
      name: "report.pdf",
      mime: "application/pdf",
      size: 12,
      blob: blobOf("%PDF"),
    });
    const openFilePreview = vi.fn();

    await openArcanaDocumentPreview({ document, openFilePreview });

    // The provider's calls take the storage segment of a shared collection.
    expect(mocks.provider.listFiles).toHaveBeenCalledWith("alice__papers", {
      includeTags: false,
    });
    expect(mocks.provider.readOriginalFile).toHaveBeenCalledWith(
      "alice__papers",
      { name: "report.pdf", markdown: true },
    );

    const [request] = openFilePreview.mock.calls[0];
    expect(request).toMatchObject({
      entry: { name: "report.pdf", mime: "application/pdf", size: 12 },
      url: "blob:document",
      page: 7,
    });
    // The object URL is released when the next preview opens.
    request.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:document");
  });

  it("opens a text file as text and keeps no object URL", async () => {
    mocks.provider.listFiles.mockResolvedValue([{ name: "notes.md" }]);
    mocks.provider.readOriginalFile.mockResolvedValue({
      name: "notes.md",
      mime: "text/markdown",
      size: 6,
      blob: blobOf("# hi", "text/markdown"),
    });
    const openFilePreview = vi.fn();

    await openArcanaDocumentPreview({
      document: { ...document, filename: "notes.md", page: undefined },
      openFilePreview,
    });

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(openFilePreview).toHaveBeenCalledWith({
      entry: { name: "notes.md", mime: "text/markdown", size: 6 },
      text: "# hi",
      page: undefined,
    });
  });

  it("fails loudly when the collection or the file is gone", async () => {
    mocks.provider.listCollections.mockResolvedValue([]);
    await expect(
      openArcanaDocumentPreview({
        document,
        openFilePreview: vi.fn(),
      }),
    ).rejects.toThrow("Collection not found");

    mocks.provider.listCollections.mockResolvedValue([collection]);
    mocks.provider.listFiles.mockResolvedValue([{ name: "other.pdf" }]);
    await expect(
      openArcanaDocumentPreview({
        document,
        openFilePreview: vi.fn(),
      }),
    ).rejects.toThrow("File not found");
  });
});
