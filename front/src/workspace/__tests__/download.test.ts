import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canPickDownloadDirectory,
  downloadProviderEntry,
  pickDownloadDirectory,
  saveProviderEntriesToDirectory,
} from "../download";
import type { FileProvider } from "../providers/types";
import { captureDownloads } from "../../test/downloads";

const chunks = (...parts: number[][]) =>
  parts.map((part) => new Uint8Array(part));

const streamOf = (...parts: number[][]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of chunks(...parts)) controller.enqueue(part);
      controller.close();
    },
  });

const entry = (overrides: Record<string, unknown> = {}) =>
  ({
    path: "/charts/random-chart.png",
    name: "random-chart.png",
    kind: "file",
    mime: "image/png",
    size: 5,
    ...overrides,
  }) as any;

const providerWith = (overrides: Record<string, unknown> = {}) =>
  ({
    sourceId: "workspace-root:workspace",
    kind: "browser",
    status: "connected",
    capabilities: {},
    connect: vi.fn(async () => {}),
    read: vi.fn(async () => streamOf([1, 2], [3, 4, 5])),
    ...overrides,
  }) as unknown as FileProvider;

describe("downloadProviderEntry", () => {
  let downloads;

  beforeEach(() => {
    downloads = captureDownloads();
  });

  afterEach(() => downloads.restore());

  it("downloads the complete content, not only the first chunk", async () => {
    const provider = providerWith();

    await downloadProviderEntry(provider, entry());

    expect(provider.read).toHaveBeenCalledWith("/charts/random-chart.png");
    expect(downloads.blobs).toHaveLength(1);
    expect(downloads.blobs[0].type).toBe("image/png");
    expect(await downloads.bytes()).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    const [link] = downloads.links();
    expect(link.download).toBe("random-chart.png");
    expect(link.href).toBe("blob:download-1");
  });

  it("keeps binary bytes, not the string form of the buffer", async () => {
    const provider = providerWith({
      read: vi.fn(
        async () =>
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
              controller.close();
            },
          }),
      ),
    });

    await downloadProviderEntry(provider, entry());

    expect(await downloads.bytes()).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it("connects a provider that is not connected yet", async () => {
    const provider = providerWith({ status: "needs-permission" });

    await downloadProviderEntry(provider, entry());

    expect(provider.connect).toHaveBeenCalledTimes(1);
    expect(await downloads.bytes()).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("falls back to a generic content type without a mime", async () => {
    await downloadProviderEntry(providerWith(), entry({ mime: undefined }));

    expect(downloads.blobs[0].type).toBe("application/octet-stream");
  });

  it("does nothing for a directory", async () => {
    const provider = providerWith();

    await downloadProviderEntry(provider, entry({ kind: "dir" }));

    expect(provider.read).not.toHaveBeenCalled();
    expect(downloads.blobs).toEqual([]);
  });

  it("reports a failed read instead of downloading an empty file", async () => {
    const provider = providerWith({
      read: vi.fn(async () => {
        throw new Error("offline");
      }),
    });

    await expect(downloadProviderEntry(provider, entry())).rejects.toThrow(
      "offline",
    );
    expect(downloads.blobs).toEqual([]);
  });
});

type FakeDirectory = FileSystemDirectoryHandle & {
  files: Map<string, Uint8Array>;
  aborts: string[];
};

const fakeDirectory = (
  options: { existing?: string[]; failWrite?: string[] } = {},
): FakeDirectory => {
  const files = new Map<string, Uint8Array>();
  const handles = new Set(options.existing ?? []);
  const aborts: string[] = [];

  const directory = {
    name: "Downloads",
    files,
    aborts,
    getFileHandle: vi.fn(
      async (name: string, createOptions?: { create?: boolean }) => {
        if (!handles.has(name) && !createOptions?.create) {
          const error = new Error(
            "A requested file or directory could not be found.",
          );
          error.name = "NotFoundError";
          throw error;
        }
        handles.add(name);
        return {
          name,
          createWritable: vi.fn(async () => {
            let buffer = new Uint8Array();
            return {
              write: vi.fn(async (data: Uint8Array) => {
                if (options.failWrite?.includes(name)) {
                  throw new Error("Disk full");
                }
                buffer = data;
              }),
              close: vi.fn(async () => {
                files.set(name, buffer);
              }),
              abort: vi.fn(async () => {
                aborts.push(name);
              }),
            };
          }),
        };
      },
    ),
  };

  return directory as unknown as FakeDirectory;
};

describe("saveProviderEntriesToDirectory", () => {
  const item = (provider: FileProvider, name: string) => ({
    provider,
    entry: entry({ name, path: `/${name}` }),
  });

  it("writes every entry into the folder under its own name", async () => {
    const directory = fakeDirectory();
    const first = providerWith({ read: vi.fn(async () => streamOf([65])) });
    const second = providerWith({ read: vi.fn(async () => streamOf([66])) });

    const failures = await saveProviderEntriesToDirectory(directory, [
      item(first, "a.txt"),
      item(second, "b.txt"),
    ]);

    expect(failures).toEqual([]);
    expect([...directory.files.keys()]).toEqual(["a.txt", "b.txt"]);
    expect(directory.files.get("a.txt")).toEqual(new Uint8Array([65]));
  });

  it("never overwrites a file that is already in the folder", async () => {
    const directory = fakeDirectory({ existing: ["report.pdf"] });

    await saveProviderEntriesToDirectory(directory, [
      item(providerWith(), "report.pdf"),
    ]);

    expect(directory.files.has("report.pdf")).toBe(false);
    expect(directory.files.has("report (2).pdf")).toBe(true);
  });

  it("keeps two same-named files from different folders apart", async () => {
    const directory = fakeDirectory();

    await saveProviderEntriesToDirectory(directory, [
      item(providerWith(), "notes.txt"),
      item(providerWith(), "notes.txt"),
    ]);

    expect([...directory.files.keys()]).toEqual([
      "notes.txt",
      "notes (2).txt",
    ]);
  });

  it("connects a provider that is not connected yet", async () => {
    const directory = fakeDirectory();
    const provider = providerWith({ status: "needs-permission" });

    await saveProviderEntriesToDirectory(directory, [
      item(provider, "a.txt"),
    ]);

    expect(provider.connect).toHaveBeenCalledTimes(1);
    expect(directory.files.has("a.txt")).toBe(true);
  });

  it("reports a failed write by name and keeps saving the rest", async () => {
    const directory = fakeDirectory({ failWrite: ["b.txt"] });

    const failures = await saveProviderEntriesToDirectory(directory, [
      item(providerWith(), "a.txt"),
      item(providerWith(), "b.txt"),
      item(providerWith(), "c.txt"),
    ]);

    expect(failures).toEqual([{ name: "b.txt", message: "Disk full" }]);
    expect([...directory.files.keys()]).toEqual(["a.txt", "c.txt"]);
    // A half-written file is aborted instead of closed.
    expect(directory.aborts).toEqual(["b.txt"]);
  });
});

describe("pickDownloadDirectory", () => {
  afterEach(() => {
    delete (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker;
  });

  it("reports the picker as unavailable without the browser API", async () => {
    expect(canPickDownloadDirectory()).toBe(false);
    await expect(pickDownloadDirectory()).resolves.toBeNull();
  });

  it("returns the folder the user picked", async () => {
    const picked = { name: "Downloads" } as FileSystemDirectoryHandle;
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker =
      vi.fn(async () => picked);

    expect(canPickDownloadDirectory()).toBe(true);
    await expect(pickDownloadDirectory()).resolves.toBe(picked);
  });

  it("treats a cancelled picker as no folder", async () => {
    const cancelled = new Error("The user aborted a request.");
    cancelled.name = "AbortError";
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker =
      vi.fn(async () => {
        throw cancelled;
      });

    await expect(pickDownloadDirectory()).resolves.toBeNull();
  });

  it("rethrows a picker that failed for another reason", async () => {
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker =
      vi.fn(async () => {
        throw new Error("No permission");
      });

    await expect(pickDownloadDirectory()).rejects.toThrow("No permission");
  });
});
