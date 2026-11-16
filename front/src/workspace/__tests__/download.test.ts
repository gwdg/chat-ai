import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadProviderEntry } from "../download";
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
