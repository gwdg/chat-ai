import { describe, expect, it, vi } from "vitest";

import { FULL_CAPABILITIES } from "../capabilities";
import { ReadOnlyProvider } from "../providers/readOnly";
import type { FileProvider } from "../providers/types";

const inner = (overrides: Record<string, any> = {}) =>
  ({
    sourceId: "src-1",
    kind: "browser",
    capabilities: { ...FULL_CAPABILITIES },
    status: "connected",
    connect: vi.fn(async () => {}),
    list: vi.fn(async () => ({ entries: [] })),
    stat: vi.fn(async () => ({ path: "/" })),
    read: vi.fn(async () => new ReadableStream()),
    write: vi.fn(async () => ({})),
    append: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    move: vi.fn(async () => {}),
    copy: vi.fn(async () => {}),
    ...overrides,
  }) as unknown as FileProvider;

describe("ReadOnlyProvider", () => {
  it("narrows the capabilities of the wrapped provider", () => {
    const provider = new ReadOnlyProvider(inner());

    expect(provider.capabilities).toMatchObject({
      read: true,
      write: false,
      append: false,
      delete: false,
      mkdir: false,
      rename: false,
      move: false,
      copy: false,
    });
  });

  it("passes reads through and refuses every write", async () => {
    const wrapped = inner();
    const provider = new ReadOnlyProvider(wrapped);

    await provider.list("/");
    await provider.stat("/a.txt");
    await provider.read("/a.txt");
    expect(wrapped.list).toHaveBeenCalledWith("/", undefined);
    expect(wrapped.read).toHaveBeenCalledWith("/a.txt", undefined);

    const writes: Array<() => Promise<unknown>> = [
      () => (provider.write as any)(),
      () => (provider.append as any)(),
      () => (provider.rename as any)(),
      () => (provider.mkdir as any)(),
      () => (provider.remove as any)(),
      () => (provider.move as any)(),
    ];
    for (const call of writes) {
      await expect(call()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    }
    expect(wrapped.write).not.toHaveBeenCalled();
    expect(wrapped.append).not.toHaveBeenCalled();
    expect(wrapped.rename).not.toHaveBeenCalled();
  });
});
