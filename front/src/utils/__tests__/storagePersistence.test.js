import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStorageStatus,
  requestPersistentStorage,
} from "../storagePersistence";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage persistence", () => {
  it("requests and reports persistent storage", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persist: vi.fn(async () => true),
        persisted: vi.fn(async () => true),
        estimate: vi.fn(async () => ({ usage: 1024, quota: 2048 })),
      },
    });

    await expect(requestPersistentStorage()).resolves.toBe(true);
    await expect(getStorageStatus()).resolves.toEqual({
      supported: true,
      persisted: true,
      usage: 1024,
      quota: 2048,
    });
  });

  it("handles unavailable storage", async () => {
    vi.stubGlobal("navigator", {});

    await expect(requestPersistentStorage()).resolves.toBe(false);
    await expect(getStorageStatus()).resolves.toEqual({
      supported: false,
      persisted: false,
    });
  });
});
