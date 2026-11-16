import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatFilePreviewPanel from "../ChatFilePreviewPanel";
// A markdown attachment renders through the chat's MarkdownRenderer, which reads Redux.
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));

import { loadFile } from "../../../db";
import { captureDownloads } from "../../../test/downloads";

// `useFile` loads metadata and bytes separately, so the content can still be pending when
// the header and its download action are already visible.
const view = vi.hoisted(() => ({
  preview: { fileId: "file-1" },
  meta: null,
  data: null,
  file: null,
  text: "the content",
  closeFilePreview: null,
}));

vi.mock("../../../db", () => ({
  useFileMeta: () => view.meta,
  useFile: () => ({ file: view.meta, data: view.data }),
  useFileBase64: () => null,
  useFileContent: () => view.text,
  loadFile: vi.fn(async () => view.file),
}));

vi.mock("../../../context/FilePreviewContext", () => ({
  useFilePreview: () => ({
    preview: view.preview,
    toggleFilePreview: vi.fn(),
    closeFilePreview: view.closeFilePreview,
  }),
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

const bytes = () => {
  const data = new Uint8Array(64);
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < data.length; i += 1) data[i] = i;
  return data;
};

const meta = (name = "random-chart.png") => ({
  name,
  type: "image/png",
  size: 64,
});

describe("ChatFilePreviewPanel", () => {
  let downloads;

  beforeEach(() => {
    downloads = captureDownloads();
    view.closeFilePreview = vi.fn();
    vi.mocked(loadFile).mockClear();
    view.preview = { fileId: "file-1" };
    view.meta = meta();
    view.data = null;
    view.file = null;
    view.text = "the content";
  });

  afterEach(() => downloads.restore());

  const save = () =>
    fireEvent.click(screen.getByRole("button", { name: "Download file" }));

  it("saves the complete file even when the bytes have not loaded yet", async () => {
    const content = bytes();
    // Metadata is there, which renders the panel, but the bytes are still pending.
    view.file = new File([content], "random-chart.png", { type: "image/png" });

    render(<ChatFilePreviewPanel />);

    expect(screen.getByText("random-chart.png")).toBeInTheDocument();
    save();

    await waitFor(() => expect(loadFile).toHaveBeenCalledWith("file-1"));
    await waitFor(() => expect(downloads.blobs).toHaveLength(1));
    expect(await downloads.bytes()).toEqual(content);
    expect(downloads.blobs[0].size).toBe(content.length);
    const [link] = downloads.links();
    expect(link.download).toBe("random-chart.png");
  });

  it("reports a missing file instead of saving an empty download", async () => {
    render(<ChatFilePreviewPanel />);

    save();

    await waitFor(() => expect(loadFile).toHaveBeenCalledWith("file-1"));
    expect(downloads.blobs).toEqual([]);
    expect(downloads.links()).toEqual([]);
  });

  it("closes through the panel header", () => {
    render(<ChatFilePreviewPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(view.closeFilePreview).toHaveBeenCalled();
  });

  it("renders through the shared preview, like the workspace panel", () => {
    view.meta = { name: "data.csv", type: "text/csv", size: 10 };
    view.text = "name,size\nalpha,1\nbeta,2";

    render(<ChatFilePreviewPanel />);

    expect(
      screen.getByRole("columnheader", { name: "name" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "beta" })).toBeInTheDocument();
  });

  it("renders nothing without a preview request", () => {
    view.preview = null;

    render(<ChatFilePreviewPanel />);

    expect(screen.queryByRole("button", { name: "Download file" })).not.toBeInTheDocument();
  });
});
