import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCollections: vi.fn(),
  invalidateCollections: vi.fn(),
  listFiles: vi.fn(),
}));

vi.mock("../providers/saiaRag", () => ({
  SaiaRagProvider: class {
    listCollections(...args) {
      return mocks.listCollections(...args);
    }

    invalidateCollections(...args) {
      return mocks.invalidateCollections(...args);
    }

    listFiles(...args) {
      return mocks.listFiles(...args);
    }
  },
  ragCollectionDisplayName: (collection) => collection?.name ?? "",
}));

import { refreshArcanas, useArcanas } from "../arcanas";

const collection = (isPublic: boolean) => ({
  name: "recipes",
  collection: "alice__recipes",
  owner: "alice",
  role: "owner",
  can_write: true,
  can_manage: true,
  shared: false,
  public: isPublic,
  description: "",
});

/** A promise whose resolution the test decides. */
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("refreshArcanas", () => {
  beforeEach(() => {
    mocks.listCollections.mockReset();
    mocks.invalidateCollections.mockReset();
    mocks.listFiles.mockReset();
    mocks.listFiles.mockResolvedValue([]);
  });

  // The Share tab's public switch writes the marker and then re-reads the list.
  // A read that was already running still answers with the flag the write
  // replaced; adopting it would put the old value — and the chat link that
  // only exists while the collection is public — back on screen.
  it("drops a list read that a newer read replaced", async () => {
    const stale = deferred();
    const current = deferred();
    mocks.listCollections
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(current.promise);

    const { result } = renderHook(() => useArcanas(false));

    act(() => {
      void refreshArcanas();
    });
    let fresh;
    act(() => {
      fresh = refreshArcanas({ fresh: true });
    });
    expect(mocks.listCollections).toHaveBeenCalledTimes(2);

    await act(async () => {
      current.resolve([collection(false)]);
      await fresh;
    });
    await waitFor(() =>
      expect(result.current.collections).toHaveLength(1),
    );
    expect(result.current.collections[0].public).toBe(false);
    expect(result.current.loading).toBe(false);

    // The abandoned read answers afterwards with what it saw before the write.
    await act(async () => {
      stale.resolve([collection(true)]);
    });

    expect(result.current.collections[0].public).toBe(false);
    expect(result.current.loaded).toBe(true);
  });

  it("shares one request while no read was abandoned", async () => {
    const only = deferred();
    mocks.listCollections.mockReturnValueOnce(only.promise);

    const first = refreshArcanas();
    const second = refreshArcanas();
    expect(mocks.listCollections).toHaveBeenCalledTimes(1);

    await act(async () => {
      only.resolve([collection(true)]);
      await Promise.all([first, second]);
    });

    expect(mocks.listCollections).toHaveBeenCalledTimes(1);
  });
});
