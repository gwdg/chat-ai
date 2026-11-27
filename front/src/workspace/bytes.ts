/**
 * One chunk as bytes. The stream is typed `Uint8Array`, but a provider can still
 * hand over a `Blob`/`File` at runtime, and `Blob.length` is `undefined`: the
 * total then became `NaN` and the result an empty array instead of the content.
 * Anything else is an error rather than a silent zero-length chunk.
 */
const chunkBytes = async (value: unknown): Promise<Uint8Array> => {
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }
  throw new TypeError("readAll received a chunk that is not bytes");
};

export const readAll = async (
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const chunk = await chunkBytes(value);
      chunks.push(chunk);
      length += chunk.length;
    }
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
};

export const toBytes = readAll;

export const streamOf = (
  data: Uint8Array | string,
): ReadableStream<Uint8Array> => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
};

export const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Base64 for a whole buffer, in chunks small enough for `String.fromCharCode`. */
export const toBase64 = (data: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};
