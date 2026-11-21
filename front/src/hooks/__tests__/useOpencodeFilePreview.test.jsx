import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apis/opencodeAgents", () => ({
  readOpencodeFile: vi.fn(async (_agent, path) => {
    const image = /\.(png|jpe?g|webp)$/i.test(path);
    return {
      blob: new Blob([`content of ${path}`], {
        type: image ? "image/png" : "text/markdown",
      }),
      type: image ? "image/png" : "text/markdown",
    };
  }),
  listOpencodeFiles: vi.fn(async () => []),
  writeOpencodeFile: vi.fn(async () => null),
}));

import {
  listOpencodeFiles,
  writeOpencodeFile,
} from "../../apis/opencodeAgents";
import { useOpencodeFilePreview } from "../useOpencodeFilePreview";

const agent = { id: "agent-1", serverUrl: "http://127.0.0.1:9999" };
const entry = { path: "/work/notes.md", name: "notes.md", kind: "file" };
const image = { path: "/work/chart.png", name: "chart.png", kind: "file" };

describe("useOpencodeFilePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOpencodeFiles.mockResolvedValue([]);
  });

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

  it("writes a description beside the image and shows it", async () => {
    const { result } = renderHook(() => useOpencodeFilePreview(agent));

    await act(async () => {
      await result.current.openFile(image);
    });
    await waitFor(() =>
      expect(result.current.preview?.saveDescription).toEqual(expect.any(Function)),
    );

    await act(async () => {
      await result.current.preview.saveDescription(
        "# chart.png\n\nA chart.\n",
        "chart-description.md",
      );
    });

    expect(writeOpencodeFile).toHaveBeenCalledWith(
      agent,
      "/work/chart-description.md",
      expect.any(Blob),
      "text/markdown",
    );
    // The description replaces the image in the preview pane.
    await waitFor(() =>
      expect(result.current.preview?.entry?.name).toBe("chart-description.md"),
    );
    expect(result.current.preview?.text).toBe(
      "content of /work/chart-description.md",
    );
  });

  it("finds an existing description in the image's folder", async () => {
    listOpencodeFiles.mockResolvedValue([
      { name: "chart-description.md", path: "/work/chart-description.md" },
    ]);
    const { result } = renderHook(() => useOpencodeFilePreview(agent));

    await act(async () => {
      await result.current.openFile(image);
    });
    await waitFor(() =>
      expect(result.current.preview?.descriptionExists).toEqual(
        expect.any(Function),
      ),
    );

    await expect(
      result.current.preview.descriptionExists("chart-description.md"),
    ).resolves.toBe(true);
    expect(listOpencodeFiles).toHaveBeenCalledWith(agent, "/work");
    expect(writeOpencodeFile).not.toHaveBeenCalled();
  });

  it("reports no description when the folder does not hold it", async () => {
    const { result } = renderHook(() => useOpencodeFilePreview(agent));

    await act(async () => {
      await result.current.openFile(image);
    });
    await waitFor(() =>
      expect(result.current.preview?.descriptionExists).toEqual(
        expect.any(Function),
      ),
    );

    await expect(
      result.current.preview.descriptionExists("chart-description.md"),
    ).resolves.toBe(false);
  });

  it("opens an existing description without touching the image", async () => {
    const { result } = renderHook(() => useOpencodeFilePreview(agent));

    await act(async () => {
      await result.current.openFile(image);
    });
    await waitFor(() =>
      expect(result.current.preview?.openDescription).toEqual(
        expect.any(Function),
      ),
    );

    await act(async () => {
      await result.current.preview.openDescription("chart-description.md");
    });

    await waitFor(() =>
      expect(result.current.preview?.entry?.path).toBe(
        "/work/chart-description.md",
      ),
    );
    expect(result.current.preview?.text).toBe(
      "content of /work/chart-description.md",
    );
    expect(writeOpencodeFile).not.toHaveBeenCalled();
  });
});
