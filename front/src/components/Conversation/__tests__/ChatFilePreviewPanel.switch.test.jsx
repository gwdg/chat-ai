import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChatFilePreviewPanel from "../ChatFilePreviewPanel";
// A markdown attachment renders through the chat's MarkdownRenderer, which reads Redux.
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));

import { saveFileReady } from "../../../db";

// Switching from one attachment to another must never reuse the previous file's bytes.
// A markdown data URL inside an <img> is what produced "Error: Failed to load image".
const view = vi.hoisted(() => ({
  preview: null,
  closeFilePreview: vi.fn(),
}));

vi.mock("../../../context/FilePreviewContext", () => ({
  useFilePreview: () => view,
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const pngBytes = () => {
  const bytes = new Uint8Array(PNG_SIGNATURE.length + 16);
  bytes.set(PNG_SIGNATURE);
  for (let i = PNG_SIGNATURE.length; i < bytes.length; i += 1) bytes[i] = i;
  return bytes;
};

describe("ChatFilePreviewPanel file switch", () => {
  beforeEach(() => view.closeFilePreview.mockClear());

  it("does not show the previous file's bytes as an image", async () => {
    const markdownId = await saveFileReady(
      "switch-preview",
      new File(["hello markdown"], "notes.md", { type: "text/markdown" }),
    );
    const imageId = await saveFileReady(
      "switch-preview",
      new File([pngBytes()], "chart.png", { type: "image/png" }),
    );

    view.preview = { fileId: markdownId };
    const { rerender } = render(<ChatFilePreviewPanel />);
    expect(await screen.findByText(/hello markdown/)).toBeInTheDocument();

    view.preview = { fileId: imageId };
    rerender(<ChatFilePreviewPanel />);

    // Neither the old text nor an <img> with the old bytes may survive the switch.
    expect(screen.queryByText(/hello markdown/)).not.toBeInTheDocument();
    expect(document.querySelector("aside img")).toBeNull();
    expect(screen.queryByText(/Failed to load image/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector("aside img")?.getAttribute("src")).toMatch(
        /^data:image\/png/,
      );
    });
    expect(screen.queryByText(/Failed to load image/)).not.toBeInTheDocument();
  });

  it("shows the text of the file it was switched to", async () => {
    const firstId = await saveFileReady(
      "switch-preview",
      new File(["first text"], "first.md", { type: "text/markdown" }),
    );
    const secondId = await saveFileReady(
      "switch-preview",
      new File(["second text"], "second.md", { type: "text/markdown" }),
    );

    view.preview = { fileId: firstId };
    const { rerender } = render(<ChatFilePreviewPanel />);
    expect(await screen.findByText(/first text/)).toBeInTheDocument();

    view.preview = { fileId: secondId };
    rerender(<ChatFilePreviewPanel />);

    expect(screen.queryByText(/first text/)).not.toBeInTheDocument();
    expect(await screen.findByText(/second text/)).toBeInTheDocument();
  });
});
