import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArcanaFilesystemProvider } from "../providers/arcanaFilesystem";

const api = vi.hoisted(() => ({
  listArcanas: vi.fn(),
  listFiles: vi.fn(),
  readFile: vi.fn(),
  uploadFile: vi.fn(),
  replaceFile: vi.fn(),
  deleteFile: vi.fn(),
  createArcana: vi.fn(),
}));

vi.mock("../../agent/arcanaV2", () => ({
  createArcana: (...args) => api.createArcana(...args),
  deleteArcanaFile: (...args) => api.deleteFile(...args),
  listArcanaFiles: (...args) => api.listFiles(...args),
  listArcanas: (...args) => api.listArcanas(...args),
  readArcanaFile: (...args) => api.readFile(...args),
  replaceArcanaFile: (...args) => api.replaceFile(...args),
  uploadArcanaFile: (...args) => api.uploadFile(...args),
}));

const read = async (stream) => {
  const reader = stream.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(...value);
  }
  return new Uint8Array(chunks);
};

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  api.listArcanas.mockResolvedValue([
    { name: "Research" },
    { name: "Notes" },
  ]);
  api.listFiles.mockResolvedValue([
    { filename: "a.txt", size_bytes: 3 },
    { filename: "b.md" },
  ]);
  api.readFile.mockResolvedValue({ content: btoa("abc") });
  api.uploadFile.mockResolvedValue({});
  api.replaceFile.mockResolvedValue({});
  api.deleteFile.mockResolvedValue(null);
  api.createArcana.mockResolvedValue(null);
});

describe("ArcanaFilesystemProvider", () => {
  it("lists Arcanas as folders and their files beneath them", async () => {
    const provider = new ArcanaFilesystemProvider("source-1");
    await provider.connect();

    const root = await provider.list("/");
    expect(root.entries.map((entry) => [entry.name, entry.kind])).toEqual([
      ["Research", "dir"],
      ["Notes", "dir"],
    ]);

    const folder = await provider.list("/Research");
    expect(folder.entries.map((entry) => entry.path)).toEqual([
      "/Research/a.txt",
      "/Research/b.md",
    ]);
  });

  it("reads and writes files through ArcanaV2", async () => {
    const provider = new ArcanaFilesystemProvider("source-1");
    await provider.connect();

    expect([...(await read(await provider.read("/Research/a.txt")))]).toEqual([
      97, 98, 99,
    ]);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([120, 121, 122]));
        controller.close();
      },
    });
    await provider.write("/Research/new.txt", stream, {
      overwrite: false,
      size: 3,
    });
    expect(api.uploadFile).toHaveBeenCalledWith(
      "Research",
      "new.txt",
      btoa("xyz"),
      "base64",
    );
  });

  it("creates an Arcana folder and deletes files", async () => {
    const provider = new ArcanaFilesystemProvider("source-1");
    await provider.connect();

    await provider.mkdir("/New");
    expect(api.createArcana).toHaveBeenCalledWith("New");

    await provider.remove("/Research/a.txt");
    expect(api.deleteFile).toHaveBeenCalledWith("Research", "a.txt");
  });
});
