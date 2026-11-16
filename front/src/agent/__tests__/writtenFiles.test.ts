import { describe, expect, it, vi } from "vitest";
import { createWrittenFiles, guessType, resultImages } from "../writtenFiles";
import { loadFile } from "../../db";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A file with a real PNG signature and random payload bytes, as a chart tool would write it. */
const randomPng = (size = 512) => {
  const bytes = new Uint8Array(PNG_SIGNATURE.length + size);
  bytes.set(PNG_SIGNATURE);
  crypto.getRandomValues(bytes.subarray(PNG_SIGNATURE.length));
  return bytes;
};

const conversationId = "conversation-written-files";

const workspaceFor = (files: Record<string, Uint8Array>) => ({
  readFile: async (path: string) => {
    const bytes = files[path];
    if (!bytes) throw new Error(`ENOENT: ${path}`);
    return bytes;
  },
});

/** saveFile persists in the background, so wait for the row like the UI hooks do. */
const readSaved = (fileId: string) =>
  vi.waitFor(async () => {
    const file = await loadFile(fileId);
    expect(file).not.toBeNull();
    return file as File;
  });

describe("files the agent writes", () => {
  it("saves a created png with random data as an attachment", async () => {
    const bytes = randomPng();
    const files = createWrittenFiles(
      conversationId,
      workspaceFor({ "/charts/random-chart.png": bytes }),
    );

    // What the agent's write tool reports to the turn.
    files.observe({ path: "/charts/random-chart.png", kind: "write" });
    await files.save();

    expect(files.items()).toHaveLength(1);
    const [item] = files.items();
    expect(item.type).toBe("file");

    const saved = await readSaved(item.fileId);
    expect(saved.name).toBe("random-chart.png");
    expect(saved.type).toBe("image/png");
    // The random bytes survive the trip through IndexedDB.
    expect(new Uint8Array(await saved.arrayBuffer())).toEqual(bytes);
  });

  it("does not attach the user's uploads below /artefacts", async () => {
    const files = createWrittenFiles(conversationId, workspaceFor({}));

    files.observe({ path: "/artefacts/1234abcd/scan.pdf", kind: "write" });
    files.observe({ path: "/artefacts/1234abcd/scan.pdf.md", kind: "write" });
    files.observe({ path: "/result.png", kind: "write" });
    files.observe({ path: "/result.png", kind: "remove" });
    await files.save();

    expect(files.items()).toEqual([]);
  });

  it("keeps one attachment per path, in the order they were written", async () => {
    const files = createWrittenFiles(conversationId, workspaceFor({
      "/a.txt": new TextEncoder().encode("a"),
      "/b.txt": new TextEncoder().encode("b"),
    }));

    files.observe({ path: "/a.txt", kind: "write" });
    files.observe({ path: "/b.txt", kind: "write" });
    files.observe({ path: "/a.txt", kind: "write" });
    await files.save();

    const items = files.items();
    expect(items).toHaveLength(2);
    expect((await readSaved(items[0].fileId)).name).toBe("a.txt");
    expect((await readSaved(items[1].fileId)).name).toBe("b.txt");
  });

  it("skips a file it cannot read and keeps the others", async () => {
    const files = createWrittenFiles(conversationId, workspaceFor({
      "/kept.txt": new TextEncoder().encode("kept"),
    }));

    files.observe({ path: "/gone.txt", kind: "write" });
    files.observe({ path: "/kept.txt", kind: "write" });
    await files.save();

    expect(files.items()).toHaveLength(1);
  });
});

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

describe("images a tool returns", () => {
  it("attaches a png the agent read, with its random data", async () => {
    const bytes = randomPng();
    const files = createWrittenFiles(conversationId, workspaceFor({}));

    await files.attachImage({
      path: "/charts/random-chart.png",
      data: toBase64(bytes),
      mimeType: "image/png",
    });

    expect(files.items()).toHaveLength(1);
    const saved = await readSaved(files.items()[0].fileId);
    expect(saved.name).toBe("random-chart.png");
    expect(saved.type).toBe("image/png");
    expect(new Uint8Array(await saved.arrayBuffer())).toEqual(bytes);
  });

  it("skips a file that is already attached and the user's uploads", async () => {
    const data = toBase64(randomPng());
    const files = createWrittenFiles(conversationId, workspaceFor({
      "/generated/image-1.png": new Uint8Array([1, 2, 3]),
    }));

    // The file was written earlier in the turn, so reading it must not attach it twice.
    files.observe({ path: "/generated/image-1.png", kind: "write" });
    await files.save();
    await files.attachImage({ path: "/generated/image-1.png", data, mimeType: "image/png" });

    // Uploads are visible in the user's message already.
    await files.attachImage({ path: "/artefacts/1234abcd/photo.png", data, mimeType: "image/png" });

    // Reading the same image twice keeps one item.
    await files.attachImage({ path: "/charts/read.png", data, mimeType: "image/png" });
    await files.attachImage({ path: "/charts/read.png", data, mimeType: "image/png" });

    expect(files.items()).toHaveLength(2);
  });

  it("names an image without a path after the tool", async () => {
    const files = createWrittenFiles(conversationId, workspaceFor({}));

    await files.attachImage({
      name: "mcp-tool-1.png",
      data: `data:image/png;base64,${toBase64(randomPng())}`,
      mimeType: "image/png",
    });

    expect((await readSaved(files.items()[0].fileId)).name).toBe("mcp-tool-1.png");
  });
});

describe("guessType", () => {
  it("maps known extensions and falls back to text", () => {
    expect(guessType("chart.PNG")).toBe("image/png");
    expect(guessType("data.csv")).toBe("text/csv");
    expect(guessType("archive.zip")).toBe("text/plain");
  });
});

describe("resultImages", () => {
  it("turns the image blocks of a tool result into attachments", () => {
    const images = resultImages(
      {
        content: [
          { type: "text", text: "Read image file [image/png]" },
          { type: "image", data: "abc", mimeType: "image/png" },
        ],
      },
      { path: "/charts/random.png", toolName: "read" },
    );

    expect(images).toEqual([
      { path: "/charts/random.png", name: undefined, data: "abc", mimeType: "image/png" },
    ]);
  });

  it("names an image after the tool when there is no path", () => {
    const [image] = resultImages(
      { content: [{ type: "image", data: "abc", mimeType: "image/jpeg" }] },
      { toolName: "fetch_preview" },
    );

    expect(image).toMatchObject({ name: "fetch_preview-1.jpg", data: "abc", mimeType: "image/jpeg" });
    expect(image.path).toBeUndefined();
  });

  it("ignores text-only and missing results", () => {
    expect(resultImages({ content: [{ type: "text", text: "done" }] })).toEqual([]);
    expect(resultImages(undefined)).toEqual([]);
  });
});
