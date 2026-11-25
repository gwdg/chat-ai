import { describe, expect, it } from "vitest";

import { readAll, toBytes } from "../bytes";

// The stream is typed as bytes, but a provider can still enqueue a `Blob` at
// runtime; these tests pin the total length and the copied content, which used
// to collapse to an empty array.
const chunkStream = (chunks: unknown[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk as Uint8Array);
      controller.close();
    },
  });

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("readAll", () => {
  it("joins the byte chunks of a stream", async () => {
    const bytes = await readAll(
      chunkStream([new Uint8Array([104, 105]), new Uint8Array([33])]),
    );
    expect(text(bytes)).toBe("hi!");
    expect(bytes.byteLength).toBe(3);
  });

  it("reads a Blob chunk as its bytes", async () => {
    // `Blob.length` is undefined, so adding it to the total made the result empty.
    const bytes = await readAll(
      chunkStream([new Blob(["abc"]), new Uint8Array([100])]),
    );
    expect(text(bytes)).toBe("abcd");
    expect(bytes.byteLength).toBe(4);
  });

  it("refuses a chunk that is not bytes instead of returning nothing", async () => {
    await expect(readAll(chunkStream(["text"]))).rejects.toThrow(TypeError);
  });

  it("is exported as toBytes", () => {
    expect(toBytes).toBe(readAll);
  });
});
