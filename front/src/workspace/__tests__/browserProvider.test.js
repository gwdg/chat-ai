import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../../db";
import { BrowserProvider } from "../providers/browser";
import { SHARED_BROWSER_STORAGE_ID } from "../browserStorage";

const streamOf = (text) =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

const readText = async (stream) => {
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(new Uint8Array(buffer));
};

const reset = async () => {
  await db.workspace_nodes.clear();
  await db.workspace_blobs.clear();
};

describe("browser provider", () => {
  beforeEach(reset);
  afterEach(reset);

  it("stores and lists files and folders in IndexedDB", async () => {
    const provider = new BrowserProvider("source-1");
    await provider.connect();

    await provider.mkdir("/docs");
    await provider.write("/docs/a.txt", streamOf("hello"), {
      overwrite: false,
    });
    await provider.write("/root.txt", streamOf("root"), { overwrite: false });

    const root = await provider.list("/");
    expect(root.entries.map((entry) => entry.name)).toEqual([
      "docs",
      "root.txt",
    ]);
    expect(root.entries[0].kind).toBe("dir");

    const docs = await provider.list("/docs");
    expect(docs.entries.map((entry) => entry.name)).toEqual(["a.txt"]);
    expect(await readText(await provider.read("/docs/a.txt"))).toBe("hello");

    await provider.remove("/docs", { recursive: true });
    expect((await provider.list("/")).entries.map((entry) => entry.name)).toEqual([
      "root.txt",
    ]);
  });

  it("shares one IndexedDB tree across browser sources", async () => {
    const first = new BrowserProvider("source-a", SHARED_BROWSER_STORAGE_ID);
    const second = new BrowserProvider(
      "workspace-root:one",
      SHARED_BROWSER_STORAGE_ID,
    );
    await first.connect();
    await second.connect();

    await first.write("/shared.txt", streamOf("shared"), { overwrite: false });

    expect(
      (await second.list("/")).entries.map((entry) => entry.name),
    ).toContain("shared.txt");
    expect(await readText(await second.read("/shared.txt"))).toBe("shared");
    expect((await second.stat("/shared.txt")).sourceId).toBe(
      "workspace-root:one",
    );
  });

  it("rejects writes that would overwrite without permission", async () => {
    const provider = new BrowserProvider("source-2");
    await provider.connect();
    await provider.write("/a.txt", streamOf("first"), { overwrite: false });
    await expect(
      provider.write("/a.txt", streamOf("second"), { overwrite: false }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
