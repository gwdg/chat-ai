import { describe, expect, it } from "vitest";

import { buildSourceBreadcrumbs, sourceUpPath } from "../breadcrumbs";

const labels = (items: ReturnType<typeof buildSourceBreadcrumbs>) =>
  items.map((item) => item.label);

describe("source breadcrumbs", () => {
  it("walks the provider path when no mount is involved", () => {
    const items = buildSourceBreadcrumbs({
      currentPath: "/a/b",
      rootLabel: "Root",
    });

    expect(labels(items)).toEqual(["Root", "a", "b"]);
    expect(items.map((item) => item.mode)).toEqual(["root", "source", "source"]);
    expect(sourceUpPath({ currentPath: "/a/b" })).toBe("/a");
    expect(sourceUpPath({ currentPath: "/" })).toBeNull();
  });

  it("keeps the workspace folders above a mount and stays in the source at the mount", () => {
    const items = buildSourceBreadcrumbs({
      currentPath: "/",
      mountPath: "/chats/abc",
      sourcePath: "/",
      rootLabel: "Root",
    });

    expect(labels(items)).toEqual(["Root", "chats", "abc"]);
    // `chats` leaves the source view, `abc` is the mount itself.
    expect(items[1]).toMatchObject({
      path: "/chats",
      mode: "root",
      target: "/chats",
    });
    expect(items[2]).toMatchObject({ mode: "source", target: "/" });
  });

  it("starts from the mount's source folder inside the provider", () => {
    const items = buildSourceBreadcrumbs({
      currentPath: "/sub/deep",
      mountPath: "/data",
      sourcePath: "/sub",
      rootLabel: "Root",
    });

    expect(labels(items)).toEqual(["Root", "data", "deep"]);
    expect(items[1]).toMatchObject({ mode: "source", target: "/sub" });
    expect(items[2]).toMatchObject({
      path: "/sub/deep",
      mode: "source",
      target: "/sub/deep",
    });
    expect(sourceUpPath({ currentPath: "/sub/deep", mountPath: "/data", sourcePath: "/sub" })).toBe("/sub");
  });

  it("moves up out of the mount at its provider root", () => {
    expect(
      sourceUpPath({
        currentPath: "/",
        mountPath: "/chats/abc",
        sourcePath: "/",
      }),
    ).toBe("/chats");
  });

  it("has no parent at the workspace root", () => {
    expect(
      sourceUpPath({ currentPath: "/", mountPath: "/", sourcePath: "/" }),
    ).toBeNull();
  });
});
