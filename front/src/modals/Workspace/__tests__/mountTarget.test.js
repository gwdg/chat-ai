import { beforeEach, describe, expect, it, vi } from "vitest";

const { rootProvider } = vi.hoisted(() => ({
  rootProvider: {
    connect: vi.fn(async () => {}),
    stat: vi.fn(),
    list: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock("../../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: () => rootProvider,
}));

import { inspectMountTarget } from "../mountTarget";

const notFound = (path = "/") => {
  const error = new Error(path);
  error.code = "NOT_FOUND";
  return error;
};

describe("inspectMountTarget", () => {
  beforeEach(() => {
    rootProvider.connect.mockClear();
    rootProvider.stat.mockReset();
    rootProvider.list.mockReset();
    rootProvider.stat.mockRejectedValue(notFound());
  });

  it("accepts a path that holds nothing yet", async () => {
    await expect(
      inspectMountTarget({ workspaceId: "ws-1", path: "/shoe" }),
    ).resolves.toBeNull();
  });

  it("rejects the reserved uploads namespace", async () => {
    await expect(
      inspectMountTarget({ workspaceId: "ws-1", path: "/uploads" }),
    ).resolves.toEqual({
      key: "workspace.mount_target_reserved",
      values: { path: "/uploads" },
    });
    await expect(
      inspectMountTarget({ workspaceId: "ws-1", path: "/uploads/photos" }),
    ).resolves.toEqual({
      key: "workspace.mount_target_reserved",
      values: { path: "/uploads/photos" },
    });
    expect(rootProvider.connect).not.toHaveBeenCalled();
  });

  it("reports a file at the path", async () => {
    rootProvider.stat.mockResolvedValue({ path: "/notes.txt", name: "notes.txt", kind: "file" });

    await expect(
      inspectMountTarget({ workspaceId: "ws-1", path: "/notes.txt" }),
    ).resolves.toEqual({
      key: "workspace.mount_target_file",
      values: { path: "/notes.txt" },
    });
  });

  it("reports a folder that already contains files", async () => {
    rootProvider.stat.mockResolvedValue({ path: "/docs", name: "docs", kind: "dir" });
    rootProvider.list.mockResolvedValue({
      entries: [{ path: "/docs/a.md", name: "a.md", kind: "file" }],
    });

    await expect(
      inspectMountTarget({ workspaceId: "ws-1", path: "/docs" }),
    ).resolves.toEqual({
      key: "workspace.mount_target_nonempty",
      values: { path: "/docs" },
    });
  });

  it("reports an empty folder", async () => {
    rootProvider.stat.mockResolvedValue({ path: "/docs", name: "docs", kind: "dir" });
    rootProvider.list.mockResolvedValue({ entries: [] });

    await expect(
      inspectMountTarget({ workspaceId: "ws-1", path: "/docs" }),
    ).resolves.toEqual({
      key: "workspace.mount_target_folder",
      values: { path: "/docs" },
    });
  });

  it("reports an existing mount without reading the workspace tree", async () => {
    await expect(
      inspectMountTarget({
        workspaceId: "ws-1",
        path: "/media",
        mountedPaths: ["/media"],
      }),
    ).resolves.toEqual({
      key: "workspace.mount_target_folder",
      values: { path: "/media" },
    });
    expect(rootProvider.connect).not.toHaveBeenCalled();
  });

  it("reports a path that would contain a mounted folder", async () => {
    await expect(
      inspectMountTarget({
        workspaceId: "ws-1",
        path: "/docs",
        mountedPaths: ["/docs/shoe"],
      }),
    ).resolves.toEqual({
      key: "workspace.mount_target_covers",
      values: { path: "/docs" },
    });
    expect(rootProvider.connect).not.toHaveBeenCalled();
  });

  it("reports a path inside a mounted folder", async () => {
    await expect(
      inspectMountTarget({
        workspaceId: "ws-1",
        path: "/media/photos",
        mountedPaths: ["/media"],
      }),
    ).resolves.toEqual({
      key: "workspace.mount_target_nested",
      values: { path: "/media/photos", mount: "/media" },
    });
    expect(rootProvider.connect).not.toHaveBeenCalled();
  });

  it("surfaces a provider failure instead of calling the path free", async () => {
    rootProvider.stat.mockRejectedValue(Object.assign(new Error("offline"), { code: "OFFLINE" }));

    await expect(
      inspectMountTarget({ workspaceId: "ws-1", path: "/docs" }),
    ).rejects.toThrow("offline");
  });
});
