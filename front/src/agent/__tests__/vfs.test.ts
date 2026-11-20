import { describe, expect, it } from "vitest";

import { MountFs, type Vfs } from "../vfs";

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
});
