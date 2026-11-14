import { describe, expect, it, vi } from "vitest";
import { uploadLocalFiles } from "../upload";
import type { FileProvider } from "../providers/types";

const providerWith = (write: (...args: any[]) => Promise<unknown>) =>
  ({ write } as unknown as FileProvider);

const readStream = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return new Uint8Array(chunks.flatMap((chunk) => [...chunk]));
};

describe("uploadLocalFiles", () => {
  it("writes every file into the current directory", async () => {
    const write = vi.fn(async () => ({}));
    const files = [
      new File([new Uint8Array([1, 2])], "a.txt"),
      new File([new Uint8Array([3])], "b.txt"),
    ];

    const uploaded = await uploadLocalFiles(providerWith(write), "/docs", files);

    expect(uploaded).toBe(2);
    expect(write).toHaveBeenNthCalledWith(
      1,
      "/docs/a.txt",
      expect.any(ReadableStream),
      { size: 2, overwrite: false },
    );
    expect(write).toHaveBeenNthCalledWith(
      2,
      "/docs/b.txt",
      expect.any(ReadableStream),
      { size: 1, overwrite: false },
    );

    const [path, stream] = write.mock.calls[0];
    expect(path).toBe("/docs/a.txt");
    expect([...(await readStream(stream))]).toEqual([1, 2]);
  });

  it("keeps uploading after a failed file and reports it", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("exists"))
      .mockResolvedValueOnce({});
    const onError = vi.fn();
    const files = [
      new File(["a"], "a.txt"),
      new File(["b"], "b.txt"),
      new File(["c"], "c.txt"),
    ];

    const uploaded = await uploadLocalFiles(
      providerWith(write),
      "/",
      files,
      onError,
    );

    expect(uploaded).toBe(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].name).toBe("b.txt");
  });
});
