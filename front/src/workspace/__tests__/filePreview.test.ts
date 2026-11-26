import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_LIMIT_BYTES, readProviderPreview } from "../filePreview";
import type { FileProvider, ProviderEntry } from "../providers/types";

// jsdom has no object-URL implementation; the resolver only needs to hand back
// a distinguishable string, so a counter is enough.
let urls = 0;
const created: string[] = [];
const revoked: string[] = [];
beforeEach(() => {
  urls = 0;
  created.length = 0;
  revoked.length = 0;
  (URL as any).createObjectURL = vi.fn(() => {
    const url = `blob:preview-${(urls += 1)}`;
    created.push(url);
    return url;
  });
  (URL as any).revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });
});

afterEach(() => {
  delete (URL as any).createObjectURL;
  delete (URL as any).revokeObjectURL;
});

const providerFor = (files: Record<string, string>): FileProvider => ({
  sourceId: "rag-1",
  kind: "saia-rag",
  capabilities: {} as never,
  status: "connected",
  connect: async () => {},
  list: async () => ({ entries: [] }),
  stat: async (path) =>
    ({ sourceId: "rag-1", path, name: path.split("/").pop(), kind: "file" }) as ProviderEntry,
  read: async (path) => {
    const content = files[path];
    if (content === undefined) throw new Error(`missing ${path}`);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(content));
        controller.close();
      },
    });
  },
  write: async () => {
    throw new Error("not used");
  },
  mkdir: async () => {},
  remove: async () => {},
});

const markdownEntry: ProviderEntry = {
  sourceId: "rag-1",
  path: "/recipes/notes.md",
  name: "notes.md",
  kind: "file",
  mime: "text/markdown",
};

describe("readProviderPreview", () => {
  it("resolves a picture next to the markdown file through the same provider", async () => {
    const provider = providerFor({
      "/recipes/notes.md": "![Bild](bild.png)",
      "/recipes/bild.png": "PNG",
    });
    const preview = await readProviderPreview(provider, markdownEntry);

    expect(preview.text).toBe("![Bild](bild.png)");
    expect(preview.resolveImage).toBeTypeOf("function");
    await expect(preview.resolveImage!("bild.png")).resolves.toBe(
      "blob:preview-1",
    );
    // A relative picture is read from the folder the document lives in.
    expect(created).toEqual(["blob:preview-1"]);
  });

  it("leaves absolute and data URLs to the renderer's own policy", async () => {
    const provider = providerFor({ "/recipes/notes.md": "x" });
    const preview = await readProviderPreview(provider, markdownEntry);

    await expect(preview.resolveImage!("https://example.org/a.png")).resolves.toBeNull();
    await expect(preview.resolveImage!("data:image/png;base64,AAAA")).resolves.toBeNull();
  });

  it("answers null for a missing picture instead of failing the preview", async () => {
    const provider = providerFor({ "/recipes/notes.md": "x" });
    const preview = await readProviderPreview(provider, markdownEntry);

    await expect(preview.resolveImage!("nope.png")).resolves.toBeNull();
  });

  it("revokes the picture URLs with the preview", async () => {
    const provider = providerFor({
      "/recipes/notes.md": "![a](a.png)",
      "/recipes/a.png": "A",
    });
    const preview = await readProviderPreview(provider, markdownEntry);
    await preview.resolveImage!("a.png");

    preview.release!();
    expect(revoked).toEqual(["blob:preview-1"]);
  });

  it("does not add an image resolver to a plain text preview", async () => {
    const provider = providerFor({ "/recipes/log.txt": "line" });
    const preview = await readProviderPreview(provider, {
      sourceId: "rag-1",
      path: "/recipes/log.txt",
      name: "log.txt",
      kind: "file",
      mime: "text/plain",
    });

    expect(preview.resolveImage).toBeUndefined();
  });

  it("refuses a file over the preview limit without reading it", async () => {
    const read = vi.fn(providerFor({}).read);
    const preview = await readProviderPreview(
      { ...providerFor({}), read },
      {
        ...markdownEntry,
        path: "/reports/big.pdf",
        name: "big.pdf",
        mime: "application/pdf",
        size: PREVIEW_LIMIT_BYTES + 1,
      },
    );

    expect(preview).toMatchObject({
      tooLarge: true,
      limitBytes: PREVIEW_LIMIT_BYTES,
    });
    expect("error" in preview && preview.error).toBeTruthy();
    // The saver exists for the user's own click; building the preview only offers it.
    expect("download" in preview && preview.download).toBeTypeOf("function");
    // Nothing is fetched, so nothing can be downloaded behind the user's back.
    expect(read).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it("applies the same limit when the provider does not report a size", async () => {
    const oversized = new Uint8Array(PREVIEW_LIMIT_BYTES + 1);
    const provider: FileProvider = {
      ...providerFor({}),
      read: async () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(oversized);
            controller.close();
          },
        }),
    };
    const preview = await readProviderPreview(provider, {
      sourceId: "rag-1",
      path: "/big.bin",
      name: "big.bin",
      kind: "file",
      mime: "application/octet-stream",
    });

    expect(preview).toMatchObject({
      tooLarge: true,
      entry: { size: PREVIEW_LIMIT_BYTES + 1 },
    });
    expect(created).toEqual([]);
  });
});
