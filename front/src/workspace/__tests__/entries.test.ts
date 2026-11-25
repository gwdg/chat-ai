import { describe, expect, it, vi } from "vitest";

import { appendToProvider, renameProviderEntry } from "../entries";
import { readAll, streamOf } from "../bytes";
import { FULL_CAPABILITIES, READ_ONLY_CAPABILITIES } from "../capabilities";
import { WorkspaceError } from "../providers/types";

const notFound = () => {
  throw new WorkspaceError("NOT_FOUND", "missing");
};

const makeProvider = (overrides: Record<string, any> = {}) =>
  ({
    sourceId: "src-1",
    kind: "browser",
    capabilities: { ...FULL_CAPABILITIES },
    status: "connected",
    connect: vi.fn(async () => {}),
    list: vi.fn(async () => ({ entries: [] })),
    stat: vi.fn(async () => notFound()),
    read: vi.fn(async () => streamOf("")),
    write: vi.fn(async () => ({})),
    mkdir: vi.fn(async () => {}),
    ...overrides,
  }) as any;

describe("renameProviderEntry", () => {
  it("uses a provider's native rename and returns the new path", async () => {
    const provider = makeProvider({ rename: vi.fn(async () => {}) });

    await expect(
      renameProviderEntry(provider, "/docs/report.md", "final.md"),
    ).resolves.toBe("/docs/final.md");
    expect(provider.rename).toHaveBeenCalledWith("/docs/report.md", "final.md");
    expect(provider.move).toBeUndefined();
  });

  it("falls back to move and checks the destination first", async () => {
    const provider = makeProvider({ move: vi.fn(async () => {}) });

    await expect(
      renameProviderEntry(provider, "/docs/report.md", "final.md"),
    ).resolves.toBe("/docs/final.md");
    expect(provider.stat).toHaveBeenCalledWith("/docs/final.md");
    expect(provider.move).toHaveBeenCalledWith(
      "/docs/report.md",
      "/docs/final.md",
    );
  });

  it("never overwrites through the move fallback", async () => {
    const provider = makeProvider({
      stat: vi.fn(async () => ({ path: "/docs/final.md" })),
      move: vi.fn(async () => {}),
    });

    await expect(
      renameProviderEntry(provider, "/docs/report.md", "final.md"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(provider.move).not.toHaveBeenCalled();
  });

  it("refuses a name that is a path and the storage root", async () => {
    const provider = makeProvider({ rename: vi.fn(async () => {}) });

    await expect(
      renameProviderEntry(provider, "/docs/report.md", "other/final.md"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
    await expect(
      renameProviderEntry(provider, "/", "root"),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(provider.rename).not.toHaveBeenCalled();
  });

  it("leaves an unchanged name alone", async () => {
    const provider = makeProvider({ rename: vi.fn(async () => {}) });

    await expect(
      renameProviderEntry(provider, "/docs/report.md", "report.md"),
    ).resolves.toBe("/docs/report.md");
    expect(provider.rename).not.toHaveBeenCalled();
  });
});

describe("appendToProvider", () => {
  it("uses a provider's native append", async () => {
    const provider = makeProvider({ append: vi.fn(async () => {}) });

    await expect(
      appendToProvider(provider, "/notes.md", "more"),
    ).resolves.toBe("/notes.md");
    expect(provider.append).toHaveBeenCalledWith("/notes.md", "more");
    expect(provider.write).not.toHaveBeenCalled();
  });

  it("reads, concatenates and writes when the provider cannot append", async () => {
    const provider = makeProvider({
      read: vi.fn(async () => streamOf("start\n")),
      stat: vi.fn(async () => ({ path: "/notes.md" })),
    });

    await appendToProvider(provider, "/notes.md", "end\n");

    const [, stream, options] = provider.write.mock.calls[0];
    expect(options).toEqual({ overwrite: true });
    expect(new TextDecoder().decode(await readAll(stream))).toBe(
      "start\nend\n",
    );
    expect(provider.mkdir).not.toHaveBeenCalled();
  });

  it("creates the file and its folder when neither exists", async () => {
    const provider = makeProvider();

    await appendToProvider(provider, "/new/notes.md", "text");

    expect(provider.mkdir).toHaveBeenCalledWith("/new");
    const [, stream] = provider.write.mock.calls[0];
    expect(new TextDecoder().decode(await readAll(stream))).toBe("text");
  });

  it("refuses a read-only source even without a native append", async () => {
    const provider = makeProvider({
      capabilities: { ...READ_ONLY_CAPABILITIES },
    });

    await expect(
      appendToProvider(provider, "/notes.md", "more"),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(provider.write).not.toHaveBeenCalled();
  });
});
