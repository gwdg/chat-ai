import { describe, expect, it } from "vitest";

import { MountFs, observe, type Change, type Vfs } from "../vfs";

const recordingFs = () => {
  const calls: string[] = [];
  const fs: Vfs = {
    readFile: async (path) => {
      calls.push(`read:${path}`);
      return new Uint8Array();
    },
    writeFile: async (path) => {
      calls.push(`write:${path}`);
    },
    mkdir: async (path) => {
      calls.push(`mkdir:${path}`);
    },
    readdir: async (path) => {
      calls.push(`readdir:${path}`);
      return [];
    },
    stat: async (path) => {
      calls.push(`stat:${path}`);
      return null;
    },
    remove: async (path) => {
      calls.push(`remove:${path}`);
    },
  };
  return { fs, calls };
};

describe("MountFs", () => {
  it("resolves dotdot before routing and passes the normalised path to the provider", async () => {
    const base = recordingFs();
    const mounted = recordingFs();
    const fs = new MountFs(base.fs);
    fs.mount("/local/photos", mounted.fs);

    await fs.writeFile("/local/photos/../x", "hello");

    expect(base.calls).toEqual(["write:/local/x"]);
    expect(mounted.calls).toEqual([]);
  });

  it("routes append and rename to the mounted filesystem", async () => {
    const base = recordingFs();
    const calls: string[] = [];
    const mounted: Vfs = {
      ...recordingFs().fs,
      appendFile: async (path) => {
        calls.push(`append:${path}`);
      },
      rename: async (path, newName) => {
        calls.push(`rename:${path}:${newName}`);
        return `${path.slice(0, path.lastIndexOf("/"))}/${newName}`;
      },
    };
    const fs = new MountFs(base.fs);
    fs.mount("/local/photos", mounted);

    await fs.appendFile("/local/photos/a.txt", "more");
    const target = await fs.rename("/local/photos/a.txt", "b.txt");

    expect(calls).toEqual(["append:/a.txt", "rename:/a.txt:b.txt"]);
    expect(target).toBe("/local/photos/b.txt");
    expect(base.calls).toEqual([]);
  });

  it("refuses to rename a mount point, which would detach the folder", async () => {
    const base = recordingFs();
    const mounted = recordingFs();
    const fs = new MountFs(base.fs);
    fs.mount("/local/photos", mounted.fs);

    await expect(fs.rename("/local/photos", "elsewhere")).rejects.toThrow(
      "Cannot rename the mount point /local/photos",
    );
    expect(mounted.calls).toEqual([]);
  });

  it("refuses append when the mounted filesystem has no append", async () => {
    const base = recordingFs();
    const mounted = recordingFs();
    const fs = new MountFs(base.fs);
    fs.mount("/local/photos", mounted.fs);

    await expect(fs.appendFile!("/local/photos/a.txt", "more")).rejects.toThrow(
      "Cannot append in /local/photos/a.txt",
    );
  });
});

describe("observe", () => {
  it("reports append as a write and a rename as remove plus write", async () => {
    const changes: Change[] = [];
    const fs: Vfs = {
      ...recordingFs().fs,
      stat: async (path) => (path.endsWith(".dir") ? { dir: true } : { dir: false }),
      appendFile: async () => {},
      rename: async (path, newName) =>
        `${path.slice(0, path.lastIndexOf("/"))}/${newName}`,
    };
    const watched = observe(fs, (change) => changes.push(change));

    await watched.appendFile!("/notes.md", "more");
    await watched.rename!("/notes.md", "final.md");
    // A folder keeps its content and only changes its name; it is not an attachment.
    await watched.rename!("/photos.dir", "images.dir");

    expect(changes).toEqual([
      { path: "/notes.md", kind: "write" },
      { path: "/notes.md", kind: "remove" },
      { path: "/final.md", kind: "write" },
      { path: "/photos.dir", kind: "remove" },
    ]);
  });
});
