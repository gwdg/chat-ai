import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaDocumentCard from "../ArcanaDocumentCard";

const mocks = vi.hoisted(() => ({
  openFilePreview: vi.fn(),
  notifyError: vi.fn(),
  openPreview: vi.fn(),
  t: vi.fn((key, options) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("../../../../context/FilePreviewContext", () => ({
  useFilePreview: () => ({ openFilePreview: mocks.openFilePreview }),
}));

vi.mock("../../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));

vi.mock("../../../../utils/arcanaDocumentPreview", () => ({
  openArcanaDocumentPreview: mocks.openPreview,
}));

const page = {
  collection: "tester/test",
  filename: "report.pdf",
  page: 7,
  pages: 2,
  excerpt:
    "[Page 7]: #\n\n[Y 10]: #\n\nWasser ist nass.\n\n[Page 8]: #\n\nImmer noch nass.",
};

const textFile = {
  collection: "tester/test",
  filename: "notes.md",
  pages: 1,
  excerpt: "# Notes\n\nHello",
};

const markdownTitle = "arcana_chat.source_markdown_open";
const originalLabel = "arcana_chat.source_open";

beforeEach(() => {
  mocks.openPreview.mockReset().mockResolvedValue(undefined);
  mocks.notifyError.mockReset();
  mocks.openFilePreview.mockReset();
});

describe("ArcanaDocumentCard", () => {
  it("lists the cited documents without printing their text", () => {
    const { container } = render(<ArcanaDocumentCard documents={[page]} />);

    expect(screen.getByText("arcana_chat.sources")).toBeTruthy();
    expect(screen.getByText("report.pdf")).toBeTruthy();
    expect(
      screen.getByText('arcana_chat.source_pages:{"from":7,"to":8}'),
    ).toBeTruthy();
    // The passage is opened in the preview, not printed below the row.
    expect(screen.queryByText("Wasser ist nass.")).toBeNull();
    expect(screen.queryByText("Immer noch nass.")).toBeNull();
    expect(screen.queryByText(/\[Y 10\]/)).toBeNull();
    // The row opens Markdown; the link beside it names the original's type.
    expect(screen.getByTitle(markdownTitle)).toBeTruthy();
    expect(screen.getByText("PDF")).toBeTruthy();
    expect(container.querySelector('[data-file-type="pdf"]')).toBeTruthy();
  });

  it("opens the cited pages as Markdown in the preview", () => {
    render(<ArcanaDocumentCard documents={[page]} />);

    fireEvent.click(screen.getByTitle(markdownTitle));

    expect(mocks.openPreview).not.toHaveBeenCalled();
    expect(mocks.openFilePreview).toHaveBeenCalledTimes(1);
    const request = mocks.openFilePreview.mock.calls[0][0];
    expect(request.entry).toMatchObject({
      name: "report.md",
      mime: "text/markdown",
    });
    expect(request.page).toBeUndefined();
    expect(request.text).toContain('## arcana_chat.source_page:{"page":7}');
    expect(request.text).toContain("Wasser ist nass.");
    expect(request.text).toContain('## arcana_chat.source_page:{"page":8}');
    expect(request.text).toContain("Immer noch nass.");
    // The converter's layout hints mean nothing to a reader.
    expect(request.text).not.toContain("[Y 10]");
  });

  it("labels a plain text file instead of inventing a page", () => {
    render(<ArcanaDocumentCard documents={[textFile]} />);
    expect(screen.getByText("arcana_chat.source_text")).toBeTruthy();
    expect(screen.queryByText(/Hello/)).toBeNull();
    expect(screen.getByText("MD")).toBeTruthy();

    fireEvent.click(screen.getByTitle(markdownTitle));
    const request = mocks.openFilePreview.mock.calls[0][0];
    expect(request.entry.name).toBe("notes.md");
    expect(request.text).toContain("Hello");
  });

  it("opens the original document at the cited page", async () => {
    render(<ArcanaDocumentCard documents={[page]} />);

    fireEvent.click(screen.getByLabelText(originalLabel));
    await waitFor(() => expect(mocks.openPreview).toHaveBeenCalledTimes(1));
    expect(mocks.openPreview).toHaveBeenCalledWith({
      document: page,
      openFilePreview: mocks.openFilePreview,
    });
    expect(mocks.openFilePreview).not.toHaveBeenCalled();
    expect(mocks.notifyError).not.toHaveBeenCalled();
  });

  it("reports a document that cannot be opened", async () => {
    mocks.openPreview.mockRejectedValue(new Error("File not found"));
    render(<ArcanaDocumentCard documents={[page]} />);

    fireEvent.click(screen.getByLabelText(originalLabel));
    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalledTimes(1));
    expect(mocks.notifyError.mock.calls[0][0]).toContain("File not found");
  });

  it("renders nothing but the heading for an empty list", () => {
    render(<ArcanaDocumentCard documents={[]} />);
    expect(screen.getByText("arcana_chat.sources")).toBeTruthy();
    expect(screen.queryByText("report.pdf")).toBeNull();
  });
});
