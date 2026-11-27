import { describe, expect, it } from "vitest";

import { createProviderGitFs } from "../providerFs";
import { streamOf } from "../../bytes";
import { createMemoryProvider } from "./memoryProvider";

describe("createProviderGitFs", () => {
  it("prefixes the selected folder and reads and writes through the provider", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/repo");
    const fs = createProviderGitFs(provider, "/repo");

    await fs.writeFile("/a.txt", "hello");
    expect(
      new TextDecoder().decode((await fs.readFile("/a.txt")) as Uint8Array),
    ).toBe("hello");
    expect(await fs.readFile("/a.txt", { encoding: "utf8" })).toBe("hello");
    expect(provider.files.get("/repo/a.txt")?.kind).toBe("file");
    expect((await fs.stat("/a.txt")).isFile()).toBe(true);
    expect(await fs.readdir("/")).toEqual(["a.txt"]);
  });

  it("maps a missing entry to ENOENT and a file listing to ENOTDIR", async () => {
    const provider = createMemoryProvider();
    const fs = createProviderGitFs(provider, "/");

    await expect(fs.stat("/nope")).rejects.toMatchObject({ code: "ENOENT" });
    await fs.writeFile("/file.txt", "x");
    await expect(fs.readdir("/file.txt")).rejects.toMatchObject({
      code: "ENOTDIR",
    });
  });

  it("refuses to create a directory that already exists", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/dir");
    const fs = createProviderGitFs(provider, "/");

    await expect(fs.mkdir("/dir")).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("follows every page of a listing", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/many");
    for (const name of ["a", "b", "c", "d", "e"]) {
      await provider.write(`/many/${name}.txt`, streamOf(`${name}\n`), {
        overwrite: true,
      });
    }
    const fs = createProviderGitFs(provider, "/");

    expect((await fs.readdir("/many")).sort()).toEqual([
      "a.txt",
      "b.txt",
      "c.txt",
      "d.txt",
      "e.txt",
    ]);
  });
});
