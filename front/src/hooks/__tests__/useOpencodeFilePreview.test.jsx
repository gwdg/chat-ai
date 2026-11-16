import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useOpencodeFilePreview } from "../useOpencodeFilePreview";

vi.mock("../../apis/opencodeAgents", () => ({
  readOpencodeFile: vi.fn(async (_agent, path) => ({
    blob: new Blob([`content of ${path}`], { type: "text/markdown" }),
    type: "text/markdown",
  })),
}));

const agent = { id: "agent-1", serverUrl: "http://127.0.0.1:9999" };
const entry = { path: "/work/notes.md", name: "notes.md", kind: "file" };

describe("useOpencodeFilePreview", () => {
  it("closes the preview when the same file is toggled again", async () => {
    const { result } = renderHook(() => useOpencodeFilePreview(agent));

    await act(async () => {
      await result.current.toggleFile(entry);
    });
    await waitFor(() =>
      expect(result.current.preview?.text).toBe("content of /work/notes.md"),
    );

    act(() => {
      result.current.toggleFile(entry);
    });

    expect(result.current.preview).toBeNull();
  });

  it("switches to the other file instead of closing", async () => {
    const { result } = renderHook(() => useOpencodeFilePreview(agent));
    const other = { path: "/work/report.csv", name: "report.csv", kind: "file" };

    await act(async () => {
      await result.current.toggleFile(entry);
    });
    await waitFor(() =>
      expect(result.current.preview?.entry?.path).toBe(entry.path),
    );

    await act(async () => {
      await result.current.toggleFile(other);
    });
    await waitFor(() =>
      expect(result.current.preview?.text).toBe("content of /work/report.csv"),
    );
    expect(result.current.preview?.entry?.path).toBe(other.path);
  });
});
