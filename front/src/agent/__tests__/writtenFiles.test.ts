import { describe, expect, it, vi } from "vitest";
import { createWrittenFiles, guessType } from "../writtenFiles";
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

describe("guessType", () => {
  it("maps known extensions and falls back to text", () => {
    expect(guessType("chart.PNG")).toBe("image/png");
    expect(guessType("data.csv")).toBe("text/csv");
    expect(guessType("archive.zip")).toBe("text/plain");
  });
});
