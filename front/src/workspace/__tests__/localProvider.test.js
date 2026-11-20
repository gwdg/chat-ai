import { beforeEach, describe, expect, it, vi } from "vitest";

const getSourceHandle = vi.fn();

vi.mock("../../db/workspaceDb", () => ({
  getSourceHandle: (...args) => getSourceHandle(...args),
}));

import { LocalProvider } from "../providers/local";

const handleWith = (grantedMode) => ({
  name: "project",
  queryPermission: vi.fn(async ({ mode }) => (mode === grantedMode ? "granted" : "prompt")),
  requestPermission: vi.fn(async ({ mode }) => (mode === grantedMode ? "granted" : "denied")),
});

describe("LocalProvider permissions", () => {
  beforeEach(() => {
    getSourceHandle.mockReset();
  });

  it("asks for write access by default", async () => {
    const handle = handleWith("readwrite");
    getSourceHandle.mockResolvedValue(handle);

    const provider = new LocalProvider("source-1", "source-1");
    await provider.connect();

    expect(provider.status).toBe("connected");
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: "readwrite" });
  });

  it("connects a read-only source with read permission only", async () => {
    const handle = handleWith("read");
    getSourceHandle.mockResolvedValue(handle);

    const provider = new LocalProvider("source-1", "source-1", true);
    await provider.connect();

    expect(provider.status).toBe("connected");
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: "read" });
  });

  it("requests read permission when access is re-granted for a read-only source", async () => {
    const handle = handleWith("read");
    getSourceHandle.mockResolvedValue(handle);

    const provider = new LocalProvider("source-1", "source-1", true);
    await provider.requestAccess();

    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: "read" });
    expect(provider.status).toBe("connected");
  });
});
