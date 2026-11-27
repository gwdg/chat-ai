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
      chunks.push(value);
      length += value.length;
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

/** Yield a stream's chunks as they arrive, without concatenating them. */
export const streamParts = async function* (
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value && value.length > 0) yield value;
    }
  } finally {
    reader.releaseLock();
  }
};

/** Yield already-read buffers, so both upload paths share one sink. */
export const arrayParts = async function* (
  parts: Uint8Array[],
): AsyncIterable<Uint8Array> {
  for (const part of parts) {
    if (part.length > 0) yield part;
  }
};

export const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

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
  // The pieces are collected and joined once: at 1 MiB per upload chunk,
  // growing one string by `+=` makes the encoder quadratic on some engines.
  const pieces: string[] = [];
  for (let i = 0; i < data.length; i += 0x8000) {
    pieces.push(String.fromCharCode(...data.subarray(i, i + 0x8000)));
  }
  return btoa(pieces.join(""));
};
