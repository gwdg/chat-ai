import { describe, expect, it } from "vitest";

import { rootEntryAction } from "../rootNavigation";

describe("rootEntryAction", () => {
  it("opens a folder in the centre browser", () => {
    expect(rootEntryAction({ kind: "dir", path: "/docs", local: true })).toEqual({
      kind: "folder",
      path: "/docs",
    });
  });

  it("shows the containing folder of a file so the preview has context", () => {
    expect(
      rootEntryAction({ kind: "file", path: "/docs/readme.md", local: true }),
    ).toEqual({ kind: "file", folder: "/docs", path: "/docs/readme.md" });
  });

  it("opens a mounted source", () => {
    const mount = {
      id: "m1",
      workspaceId: "ws",
      sourceId: "s1",
      sourcePath: "/",
      path: "/chats/abc",
      createdAt: 0,
      lastModified: 0,
    };
    expect(
      rootEntryAction({ kind: "dir", path: "/chats/abc", local: false, mount }),
    ).toEqual({ kind: "mount", mount });
  });
});
