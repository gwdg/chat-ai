// A chat stores its files in one OPFS tree at `chats/<id>`. These tests run against a small
// in-memory OPFS stand-in, because jsdom has no `navigator.storage.getDirectory()`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  chatStorageDir,
  chatStorageMountPath,
  chatStorageSize,
  chatStorageSourceId,
  copyChatStorage,
  deleteAllChatStorage,
  deleteChatStorage,
} from "../chatStorage";
import { defaultCapabilities } from "../capabilities";
import { readAll, streamOf } from "../bytes";
import { createProvider } from "../providers";

// jsdom's `Blob` has no `stream()`, while a browser `File` does — and the
// provider hands its callers real byte chunks. Adding the browser method to the
// fake keeps the read path exercised instead of skipped.
type StreamableFile = File & { stream: () => ReadableStream<Uint8Array> };

const streamable = (blob: Blob): StreamableFile => {
  const file = blob as StreamableFile;
  const slice = file.slice.bind(file);
  Object.defineProperty(file, "slice", {
    value: (start?: number, end?: number) => streamable(slice(start, end)),
  });
  Object.defineProperty(file, "stream", {
    value: () =>
      new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array(await file.arrayBuffer()));
          controller.close();
        },
      }),
  });
  return file;
};

class FakeFileHandle {
  kind = "file" as const;
  bytes = new Uint8Array();

  constructor(readonly name: string) {}

  async getFile() {
    return streamable(new File([this.bytes], this.name, { lastModified: 1 }));
  }

  async createWritable() {
    const parts: BlobPart[] = [];
    const handle = this;
    return {
      async write(chunk: BlobPart) {
        parts.push(chunk);
      },
      async close() {
        handle.bytes = new Uint8Array(await new Blob(parts).arrayBuffer());
      },
    };
  }
}

type Node = FakeDirHandle | FakeFileHandle;

class FakeDirHandle {
  kind = "directory" as const;
  children = new Map<string, Node>();

  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const found = this.children.get(name);
    if (found) {
      if (found.kind !== "directory")
        throw new DOMException("Not a directory", "TypeMismatchError");
      return found;
    }
    if (!options?.create)
      throw new DOMException("Missing", "NotFoundError");
    const dir = new FakeDirHandle(name);
    this.children.set(name, dir);
    return dir;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const found = this.children.get(name);
    if (found) {
      if (found.kind !== "file")
        throw new DOMException("Not a file", "TypeMismatchError");
      return found;
    }
    if (!options?.create)
      throw new DOMException("Missing", "NotFoundError");
    const file = new FakeFileHandle(name);
    this.children.set(name, file);
    return file;
  }

  async removeEntry(name: string, options?: { recursive?: boolean }) {
    const found = this.children.get(name);
    if (!found) throw new DOMException("Missing", "NotFoundError");
    if (found.kind === "directory" && !options?.recursive)
      throw new DOMException("In use", "InvalidModificationError");
    this.children.delete(name);
  }

  async *entries(): AsyncGenerator<[string, Node]> {
    yield* this.children.entries();
  }

  async *keys(): AsyncGenerator<string> {
    yield* this.children.keys();
  }
}

let root: FakeDirHandle;

const readFile = async (dir: FakeDirHandle, path: string) => {
  let current = dir;
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop()!;
  for (const part of parts) current = await current.getDirectoryHandle(part);
  const file = await current.getFileHandle(name);
  return new TextDecoder().decode(file.bytes);
};

const writeFile = async (dir: FakeDirHandle, path: string, text: string) => {
  let current = dir;
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop()!;
  for (const part of parts)
    current = await current.getDirectoryHandle(part, { create: true });
  const file = await current.getFileHandle(name, { create: true });
  file.bytes = new TextEncoder().encode(text);
};

const seed = async (path: string, text: string) => {
  await writeFile(root, path, text);
};

const chatProvider = (conversationId = "chat-1") =>
  createProvider({
    id: chatStorageSourceId("ws-1", conversationId),
    workspaceId: "ws-1",
    kind: "chat",
    label: "Trip planning",
    config: { conversationId },
    capabilities: defaultCapabilities("chat"),
    status: "offline",
    createdAt: 1,
    lastModified: 1,
  } as any);

describe("chat storage", () => {
  beforeEach(() => {
    root = new FakeDirHandle("");
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      storage: {
        getDirectory: async () => root,
        persist: async () => true,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a chat under chats/<id>", async () => {
    const dir = await chatStorageDir("chat-1");
    expect(dir.name).toBe("chat-1");
    await writeFile(dir, "notes.txt", "hello");

    expect(await readFile(root, "chats/chat-1/notes.txt")).toBe("hello");
    expect(await chatStorageSize("chat-1")).toBe(5);
  });

  it("moves a tree from conversations/<id> in on first use", async () => {
    await seed("conversations/chat-1/old/notes.txt", "legacy");

    const dir = await chatStorageDir("chat-1");
    expect(await readFile(dir, "old/notes.txt")).toBe("legacy");
    expect(root.children.get("conversations")?.children.has("chat-1")).toBe(
      false,
    );
    // A second call finds the new tree and does not copy again.
    await writeFile(dir, "new.txt", "new");
    const again = await chatStorageDir("chat-1");
    expect(again.children.has("new.txt")).toBe(true);
  });

  it("reports the size of a tree that still sits at the old path", async () => {
    await seed("conversations/chat-2/notes.txt", "legacy");
    expect(await chatStorageSize("chat-2")).toBe(6);
  });

  it("copies a chat's files to another chat", async () => {
    const dir = await chatStorageDir("chat-1");
    await writeFile(dir, "a/b.txt", "copy me");

    await copyChatStorage("chat-1", "chat-2");
    expect(await readFile(root, "chats/chat-2/a/b.txt")).toBe("copy me");
  });

  it("deletes the new tree and any legacy leftovers", async () => {
    await seed("conversations/chat-1/old.txt", "legacy");
    const dir = await chatStorageDir("chat-1");
    await writeFile(dir, "new.txt", "new");

    await deleteChatStorage("chat-1");
    expect(root.children.get("chats")?.children.has("chat-1")).toBe(false);
    expect(root.children.get("conversations")?.children.has("chat-1")).toBe(
      false,
    );
    expect(await chatStorageSize("chat-1")).toBe(0);
  });

  it("drops every chat tree on a database reset", async () => {
    await seed("conversations/chat-1/old.txt", "legacy");
    await seed("chats/chat-1/new.txt", "new");

    await deleteAllChatStorage();
    expect(root.children.has("chats")).toBe(false);
    expect(root.children.has("conversations")).toBe(false);
  });

  it("derives the workspace link from the conversation id", () => {
    expect(chatStorageSourceId("ws-1", "chat-1")).toBe("chat-storage:ws-1:chat-1");
    expect(chatStorageMountPath("chat-1")).toBe("/chats/chat-1");
  });

  it("serves the chat tree through the workspace file provider", async () => {
    const provider = chatProvider();
    expect(provider.kind).toBe("chat");
    await provider.connect();
    await provider.mkdir("/artefacts");
    await expect(provider.list("/")).resolves.toMatchObject({
      entries: [expect.objectContaining({ name: "artefacts", kind: "dir" })],
    });
    expect(root.children.get("chats")?.children.has("chat-1")).toBe(true);
  });

  // The provider used to enqueue the `File` itself. `readAll` then added
  // `Blob.length` (undefined) to its total, so every file in the chat's own tree
  // read back as zero bytes — the file looked empty in the preview and an agent
  // `read` returned nothing.
  it("reads a stored chat file back as its bytes", async () => {
    const provider = chatProvider();
    await provider.connect();
    await provider.mkdir("/artefacts");
    const code = "#include <iostream>\n\nint main() { return 0; }\n";
    await provider.write("/artefacts/example.cpp", streamOf(code), {
      overwrite: false,
    });

    const bytes = await readAll(await provider.read("/artefacts/example.cpp"));
    expect(bytes.byteLength).toBe(code.length);
    expect(new TextDecoder().decode(bytes)).toBe(code);

    const slice = await readAll(
      await provider.read("/artefacts/example.cpp", { start: 0, end: 18 }),
    );
    expect(new TextDecoder().decode(slice)).toBe(code.slice(0, 18));
  });
});
