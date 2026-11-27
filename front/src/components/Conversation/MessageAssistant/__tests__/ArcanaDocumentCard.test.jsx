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

beforeEach(() => {
  mocks.openPreview.mockReset().mockResolvedValue(undefined);
  mocks.notifyError.mockReset();
  mocks.openFilePreview.mockReset();
});

describe("ArcanaDocumentCard", () => {
  it("shows the cited pages and the passage, without the layout hints", () => {
    render(<ArcanaDocumentCard documents={[page]} />);

    expect(screen.getByText("arcana_chat.sources")).toBeTruthy();
    expect(screen.getByText("report.pdf")).toBeTruthy();
    expect(
      screen.getByText(
        'arcana_chat.source_pages:{"from":7,"to":8}',
      ),
    ).toBeTruthy();
    expect(screen.getByText("Wasser ist nass.")).toBeTruthy();
    expect(screen.getByText("Immer noch nass.")).toBeTruthy();
    expect(screen.queryByText(/\[Y 10\]/)).toBeNull();
  });

  it("labels a plain text file instead of inventing a page", () => {
    render(<ArcanaDocumentCard documents={[textFile]} />);
    expect(screen.getByText("arcana_chat.source_text")).toBeTruthy();
    expect(screen.getByText(/Hello/)).toBeTruthy();
  });

  it("opens the document at the cited page on click", async () => {
    render(<ArcanaDocumentCard documents={[page]} />);

    fireEvent.click(screen.getByText("report.pdf"));
    await waitFor(() => expect(mocks.openPreview).toHaveBeenCalledTimes(1));
    expect(mocks.openPreview).toHaveBeenCalledWith({
      document: page,
      openFilePreview: mocks.openFilePreview,
    });
    expect(mocks.notifyError).not.toHaveBeenCalled();
  });

  it("reports a document that cannot be opened", async () => {
    mocks.openPreview.mockRejectedValue(new Error("File not found"));
    render(<ArcanaDocumentCard documents={[page]} />);

    fireEvent.click(screen.getByText("report.pdf"));
    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalledTimes(1));
    expect(mocks.notifyError.mock.calls[0][0]).toContain("File not found");
  });

  it("renders nothing but the heading for an empty list", () => {
    render(<ArcanaDocumentCard documents={[]} />);
    expect(screen.getByText("arcana_chat.sources")).toBeTruthy();
    expect(screen.queryByText("report.pdf")).toBeNull();
  });
});
