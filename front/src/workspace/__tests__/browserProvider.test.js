import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../../db";
import { BrowserProvider } from "../providers/browser";
import { workspaceBrowserStorageId } from "../browserStorage";

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

  it("keeps each workspace's browser tree separate", async () => {
    const first = new BrowserProvider(
      "source-a",
      workspaceBrowserStorageId("one"),
    );
    const rootOfFirst = new BrowserProvider(
      "workspace-root:one",
      workspaceBrowserStorageId("one"),
    );
    const otherWorkspace = new BrowserProvider(
      "workspace-root:two",
      workspaceBrowserStorageId("two"),
    );
    await first.connect();
    await rootOfFirst.connect();
    await otherWorkspace.connect();

    await first.write("/private.txt", streamOf("one"), { overwrite: false });

    // The workspace root and its browser sources share the workspace's tree.
    expect(
      (await rootOfFirst.list("/")).entries.map((entry) => entry.name),
    ).toContain("private.txt");
    expect(await readText(await rootOfFirst.read("/private.txt"))).toBe("one");
    expect((await rootOfFirst.stat("/private.txt")).sourceId).toBe(
      "workspace-root:one",
    );

    // Another workspace does not see it.
    expect((await otherWorkspace.list("/")).entries).toEqual([]);
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
