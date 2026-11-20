// Live test against a real saia-fs instance, optionally through the deployment's
// proxy.
//
// The provider unit test beside this file replaces the MCP transport with an
// in-memory filesystem, so it pins the tool calls but cannot prove that a real
// saia-fs accepts them. This file drives the same provider against a running
// instance, including the `read_base64` / `write_base64` pair that binary
// transfers depend on.
//
// Excluded from `npm test`; run it with a server up:
//
//   saia-fs-mcp --user tester --root /tmp/saia-fs --port 8011
//   SAIA_FS_TEST_URL=http://127.0.0.1:8011/mcp npm run test:live
//
// Point `SAIA_FS_TEST_URL` at `<backend>/saia-fs/mcp` to exercise the proxy and
// the identity header as well.
import { describe, expect, it } from "vitest";

import { readAll, streamOf } from "../bytes";
import { SaiaFsProvider } from "../providers/saiaFs";

const url = process.env.SAIA_FS_TEST_URL || "";
const run = url ? describe : describe.skip;

// One binary payload with every byte value, so a text-encoded round trip cannot
// pass by accident.
const BINARY = Uint8Array.from({ length: 256 }, (_, index) => index);

run("SaiaFsProvider (live)", () => {
  it("reads, writes and moves real files, binary included", async () => {
    const provider = new SaiaFsProvider("live", url);
    await provider.connect();

    expect(provider.status).toBe("connected");
    expect(provider.capabilities).toMatchObject({
      read: true,
      write: true,
      delete: true,
      mkdir: true,
      move: true,
    });

    // An account folder the service created on first contact lists empty; an
    // older service answers "not found" for the root, which the provider also
    // shows as an empty directory.
    expect(Array.isArray((await provider.list("/")).entries)).toBe(true);

    const base = `/chat-ai-live-${Date.now()}`;
    await provider.mkdir(base);

    try {
      await provider.write(`${base}/one.bin`, streamOf(BINARY), {
        size: BINARY.length,
        overwrite: false,
      });
      const read = await readAll(await provider.read(`${base}/one.bin`));
      expect(Array.from(read)).toEqual(Array.from(BINARY));

      const page = await provider.list(base);
      expect(page.entries).toEqual([
        expect.objectContaining({
          name: "one.bin",
          kind: "file",
          size: BINARY.length,
        }),
      ]);

      // `overwrite: false` is what uploads and transfers use, and the provider
      // enforces it through saia-fs's own `exists` tool.
      await expect(
        provider.write(`${base}/one.bin`, streamOf(new Uint8Array([1])), {
          overwrite: false,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      await provider.move(`${base}/one.bin`, `${base}/two.bin`);
      expect((await provider.list(base)).entries[0]).toMatchObject({
        name: "two.bin",
      });

      const stat = await provider.stat(`${base}/two.bin`);
      expect(stat.kind).toBe("file");
      expect(stat.size).toBe(BINARY.length);
    } finally {
      await provider.remove(base, { recursive: true });
    }

    // saia-fs deletes a directory recursively, so the account folder is gone.
    await expect(provider.list(base)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
