import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSourceRow } from "../../db/dbTypes";

const mocks = vi.hoisted(() => ({
  createProvider: vi.fn(),
  updateSource: vi.fn(async () => {}),
}));

vi.mock("../providers", () => ({ createProvider: mocks.createProvider }));
vi.mock("../../db/workspaceDb", () => ({ updateSource: mocks.updateSource }));

import { useWorkspaceProviders } from "../useWorkspaceProviders";

const capabilities = {
  read: true,
  write: true,
  delete: true,
  mkdir: true,
  rename: true,
  move: true,
  copy: true,
  append: true,
} as any;

function source(patch: Partial<WorkspaceSourceRow> = {}): WorkspaceSourceRow {
  return {
    id: "s1",
    workspaceId: "w1",
    kind: "browser",
    label: "Files",
    config: {},
    capabilities,
    status: "offline",
    createdAt: 1,
    lastModified: 1,
    ...patch,
  };
}

function fakeProvider(id: string, patch: Record<string, unknown> = {}) {
  return {
    sourceId: id,
    kind: "browser",
    capabilities,
    status: "connected",
    connect: vi.fn(async () => {}),
    list: vi.fn(),
    stat: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    mkdir: vi.fn(),
    remove: vi.fn(),
    close: vi.fn(),
    ...patch,
  } as any;
}

afterEach(() => {
  mocks.createProvider.mockReset();
  mocks.updateSource.mockClear();
});

describe("useWorkspaceProviders", () => {
  it("connects one provider per source however many call sites mount it", async () => {
    const provider = fakeProvider("s1");
    mocks.createProvider.mockReturnValue(provider);
    const sources = [source()];

    const first = renderHook(() => useWorkspaceProviders(sources));
    const second = renderHook(() => useWorkspaceProviders(sources));

    await waitFor(() => expect(mocks.updateSource).toHaveBeenCalledTimes(1));
    expect(mocks.createProvider).toHaveBeenCalledTimes(1);
    expect(provider.connect).toHaveBeenCalledTimes(1);
    // This is the point: three places in one dialog used to build three
    // providers and fire three cold connects (three list_collections calls).
    expect(first.result.current.providers.get("s1")).toBe(provider);
    expect(second.result.current.providers.get("s1")).toBe(provider);
    expect(mocks.updateSource).toHaveBeenCalledWith("s1", {
      status: "connected",
      capabilities,
      error: undefined,
    });
  });

  it("keeps the provider open until the last call site unmounts", async () => {
    const provider = fakeProvider("s1");
    mocks.createProvider.mockReturnValue(provider);
    const sources = [source()];

    const first = renderHook(() => useWorkspaceProviders(sources));
    const second = renderHook(() => useWorkspaceProviders(sources));
    await waitFor(() =>
      expect(first.result.current.providers.get("s1")).toBe(provider),
    );

    first.unmount();
    expect(provider.close).not.toHaveBeenCalled();

    second.unmount();
    expect(provider.close).toHaveBeenCalledTimes(1);
  });

  it("replaces the provider when a source changes shape", async () => {
    const initial = fakeProvider("s1");
    const readOnly = fakeProvider("s1");
    mocks.createProvider
      .mockReturnValueOnce(initial)
      .mockReturnValueOnce(readOnly);

    const { result, rerender } = renderHook(
      ({ rows }: { rows: WorkspaceSourceRow[] }) =>
        useWorkspaceProviders(rows),
      { initialProps: { rows: [source()] } },
    );
    await waitFor(() => expect(result.current.providers.get("s1")).toBe(initial));

    rerender({ rows: [source({ readOnly: true })] });

    await waitFor(() =>
      expect(result.current.providers.get("s1")).toBe(readOnly),
    );
    expect(initial.close).toHaveBeenCalledTimes(1);
    expect(readOnly.connect).toHaveBeenCalledTimes(1);
  });

  it("reconnects in place so every call site sees the new provider", async () => {
    const broken = fakeProvider("s1");
    const fixed = fakeProvider("s1");
    mocks.createProvider
      .mockReturnValueOnce(broken)
      .mockReturnValueOnce(fixed);
    const sources = [source()];

    const first = renderHook(() => useWorkspaceProviders(sources));
    const second = renderHook(() => useWorkspaceProviders(sources));
    await waitFor(() =>
      expect(first.result.current.providers.get("s1")).toBe(broken),
    );

    await act(() => first.result.current.reconnect("s1"));

    expect(broken.close).toHaveBeenCalledTimes(1);
    expect(fixed.connect).toHaveBeenCalledTimes(1);
    expect(mocks.createProvider).toHaveBeenCalledTimes(2);
    expect(first.result.current.providers.get("s1")).toBe(fixed);
    expect(second.result.current.providers.get("s1")).toBe(fixed);
  });

  it("records why a connect failed", async () => {
    const provider = fakeProvider("s1", {
      connect: vi.fn(async () => {
        throw new Error("Session expired");
      }),
    });
    mocks.createProvider.mockReturnValue(provider);

    renderHook(() => useWorkspaceProviders([source()]));

    await waitFor(() =>
      expect(mocks.updateSource).toHaveBeenCalledWith("s1", {
        status: "error",
        error: "Session expired",
      }),
    );
  });
});
