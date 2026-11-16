import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PreviewModal from "../PreviewModal";
import { loadFile } from "../../../db";
import { captureDownloads } from "../../../test/downloads";

// The real hooks load metadata and bytes separately; `data` stays null until the second hook
// resolves. A downloaded file must not depend on that race.
const view = vi.hoisted(() => ({
  meta: null,
  data: null,
  file: null,
}));

vi.mock("../../../db", () => ({
  useFile: () => ({ file: view.meta, data: view.data }),
  useFileBase64: () => null,
  useFileContent: () => "the content",
  loadFile: vi.fn(async () => view.file),
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

describe("PreviewModal download", () => {
  let downloads;

  beforeEach(() => {
    downloads = captureDownloads();
    vi.mocked(loadFile).mockClear();
    view.meta = meta();
    view.data = null;
    view.file = null;
  });

  afterEach(() => downloads.restore());

  const renderModal = () =>
    render(<PreviewModal isOpen onClose={vi.fn()} fileId="file-1" />);

  const save = () =>
    fireEvent.click(screen.getByRole("button", { name: "Download file" }));

  it("saves the complete file even when the bytes have not loaded yet", async () => {
    const content = bytes();
    // Metadata is there, which renders the modal, but `useFile`'s data is still pending.
    view.file = new File([content], "random-chart.png", { type: "image/png" });

    renderModal();
    save();

    await waitFor(() => expect(downloads.blobs).toHaveLength(1));
    expect(await downloads.bytes()).toEqual(content);
    expect(downloads.blobs[0].size).toBe(content.length);
    const [link] = downloads.links();
    expect(link.download).toBe("random-chart.png");
    expect(link.href).toBe("blob:download-1");
  });

  it("downloads the same bytes that are stored, not a placeholder", async () => {
    const content = bytes();
    view.data = content.buffer;
    view.file = new File([content], "random-chart.png", { type: "image/png" });

    renderModal();
    save();

    await waitFor(() => expect(downloads.blobs).toHaveLength(1));
    expect(await downloads.bytes()).toEqual(content);
  });

  it("reports a file that is gone instead of downloading an empty file", async () => {
    view.file = null;

    renderModal();
    save();

    await waitFor(() => expect(downloads.alert).toHaveBeenCalled());
    expect(downloads.blobs).toEqual([]);
    expect(downloads.links()).toEqual([]);
  });
});
