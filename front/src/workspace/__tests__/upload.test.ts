import { describe, expect, it, vi } from "vitest";

import { uploadLocalFiles } from "../upload";

const fileOf = (text: string, name: string) =>
  new File([text], name, { type: "text/plain" });

const bytesOf = async (stream) => {
  const reader = stream.getReader();
  const parts = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(...value);
  }
  return new Uint8Array(parts);
};

const providerOf = () => {
  const writes: Array<{ path: string; bytes: Uint8Array }> = [];
  const write = vi.fn(async (path, stream, opts) => {
    // Remember what crosses the boundary: a provider gets the file's bytes,
    // not a descriptor.
    const bytes = await bytesOf(stream);
    writes.push({ path, bytes });
    opts.onProgress?.(bytes.length, bytes.length);
    return { path, name: path.split("/").pop(), kind: "file" };
  });
  return { writes, write };
};

describe("uploadLocalFiles", () => {
  it("writes each file into the folder and reports bytes before the request", async () => {
    const provider = providerOf();
    const progress = [];
    const file = fileOf("hello", "notes.txt");

    const stored = await uploadLocalFiles(provider, "/Docs", [file], undefined, {
      onProgress: (reported, sent, total) =>
        progress.push([reported.name, sent, total]),
    });

    expect(stored).toBe(1);
    expect(provider.write).toHaveBeenCalledTimes(1);
    const [path, , opts] = provider.write.mock.calls[0];
    expect(path).toBe("/Docs/notes.txt");
    expect(opts.size).toBe(5);
    expect(opts.overwrite).toBe(false);
    expect(new TextDecoder().decode(provider.writes[0].bytes)).toBe("hello");
    // Zero before the bytes are written, then the provider's own report: the
    // label names the file immediately instead of waiting for the write.
    expect(progress).toEqual([
      ["notes.txt", 0, 5],
      ["notes.txt", 5, 5],
    ]);
  });

  it("counts a failed file as an error and still uploads the rest", async () => {
    const provider = providerOf();
    provider.write.mockImplementationOnce(async () => {
      throw new Error("conflict");
    });
    const failures = [];
    const good = fileOf("b", "b.txt");

    const stored = await uploadLocalFiles(
      provider,
      "/",
      [fileOf("a", "a.txt"), good],
      (file, error) => failures.push([file.name, error.message]),
    );

    expect(stored).toBe(1);
    expect(failures).toEqual([["a.txt", "conflict"]]);
    expect(provider.write).toHaveBeenCalledTimes(2);
    expect(provider.write.mock.calls[1][0]).toBe("/b.txt");
  });

  it("passes an explicit overwrite through to the provider", async () => {
    const provider = providerOf();

    await uploadLocalFiles(provider, "/", [fileOf("x", "x.txt")], undefined, {
      overwrite: true,
    });

    expect(provider.write.mock.calls[0][2].overwrite).toBe(true);
  });
});
