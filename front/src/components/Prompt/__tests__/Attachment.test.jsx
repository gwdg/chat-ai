import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Attachment from "../Attachment";
import { loadFile } from "../../../db";
import { captureDownloads } from "../../../test/downloads";

const { notifyError, toggleFilePreview, meta } = vi.hoisted(() => ({
  notifyError: vi.fn(),
  toggleFilePreview: vi.fn(),
  meta: { value: null },
}));

const PDF_META = { name: "document.pdf", type: "application/pdf", size: 1024 };

vi.mock("../../../db", () => ({
  useFileMeta: () => meta.value,
  useFileBase64: () => null,
  loadFile: vi.fn(),
  saveFile: vi.fn(),
}));
vi.mock("../../../hooks/useAttachments", () => ({
  useAttachments: () => ({
    removeAttachment: vi.fn(),
    clearAttachments: vi.fn(),
    readFileAsBase64: vi.fn(),
  }),
}));
vi.mock("../../../context/FilePreviewContext", () => ({
  useFilePreview: () => ({ toggleFilePreview, closeFilePreview: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError }),
}));
vi.mock("../../../apis/processFile", () => ({ processFile: vi.fn() }));
vi.mock("../../../utils/browserDocumentConversion", () => ({
  canConvertDocumentLocally: () => true,
  convertDocumentLocally: vi.fn(),
}));
vi.mock("../../../Redux/reducers/userSettingsReducer", () => ({
  selectDocumentConversionMode: () => "choice",
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({}),
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => true,
}));
vi.mock("../../../agent/prepare", () => ({
  usePrepareStatus: () => undefined,
}));

const localState = {
  id: "conversation",
  settings: { model: { id: "model", input: [] }, enable_tools: false },
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: "Read this" }, { type: "file", fileId: "file" }],
    },
  ],
};

beforeEach(() => {
  meta.value = PDF_META;
});

describe("Attachment preview", () => {
  it("opens the docked preview panel instead of a modal", () => {
    toggleFilePreview.mockClear();
    render(
      <Attachment
        localState={localState}
        setLocalState={vi.fn()}
        attachment={{ fileId: "file" }}
        index={0}
      />,
    );

    fireEvent.click(screen.getByText("document.pdf"));

    expect(toggleFilePreview).toHaveBeenCalledWith({
      fileId: "file",
      name: "document.pdf",
    });
  });
});

describe("Attachment document conversion", () => {
  it("keeps the browser and server conversion buttons in agent mode", () => {
    render(
      <Attachment
        localState={localState}
        setLocalState={vi.fn()}
        attachment={{ fileId: "file" }}
        index={0}
      />,
    );

    expect(screen.getByRole("button", { name: "Process (browser)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Process (server)" })).toBeInTheDocument();
  });
});

describe("Attachment download", () => {
  let downloads;

  beforeEach(() => {
    downloads = captureDownloads();
    vi.mocked(loadFile).mockReset();
    notifyError.mockClear();
  });

  afterEach(() => downloads.restore());

  const renderAttachment = () =>
    render(
      <Attachment
        localState={localState}
        setLocalState={vi.fn()}
        attachment={{ fileId: "file" }}
        index={0}
        inHistory
      />,
    );

  it("downloads the complete file that is stored for the attachment", async () => {
    const bytes = new Uint8Array(256);
    bytes.set([0x25, 0x50, 0x44, 0x46]); // %PDF
    for (let i = 4; i < bytes.length; i += 1) bytes[i] = i;
    vi.mocked(loadFile).mockResolvedValue(
      new File([bytes], "document.pdf", { type: "application/pdf" }),
    );

    renderAttachment();
    fireEvent.click(screen.getByRole("button", { name: "Download file" }));

    await waitFor(() => expect(downloads.blobs).toHaveLength(1));
    expect(await downloads.bytes()).toEqual(bytes);
    expect(downloads.links()[0].download).toBe("document.pdf");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("reports a file that cannot be loaded instead of downloading it", async () => {
    vi.mocked(loadFile).mockResolvedValue(null);

    renderAttachment();
    fireEvent.click(screen.getByRole("button", { name: "Download file" }));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(downloads.blobs).toEqual([]);
    expect(downloads.links()).toEqual([]);
  });

  it("offers the markdown a conversion produced before the message is sent", async () => {
    // Processing replaces the document with `<name>.md`; the card is then a plain
    // attachment in the prompt, where it used to have Remove only.
    meta.value = { name: "document.pdf.md", type: "text/markdown", size: 14 };
    const bytes = new TextEncoder().encode("# Title\n\nBody");
    vi.mocked(loadFile).mockResolvedValue(
      new File([bytes], "document.pdf.md", { type: "text/markdown" }),
    );

    render(
      <Attachment
        localState={localState}
        setLocalState={vi.fn()}
        attachment={{ fileId: "file" }}
        index={0}
      />,
    );

    expect(screen.getByRole("button", { name: "Remove file" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download file" }));

    await waitFor(() => expect(downloads.blobs).toHaveLength(1));
    // Compared by content: TextEncoder and the jsdom download path return typed
    // arrays from different realms, which `toEqual` refuses.
    expect(Array.from(await downloads.bytes())).toEqual(Array.from(bytes));
    expect(downloads.links()[0].download).toBe("document.pdf.md");
  });
});

describe("Attachment when no model is selected", () => {
  it("marks a PDF as requiring processing", () => {
    render(
      <Attachment
        localState={{ ...localState, settings: { ...localState.settings, model: undefined } }}
        setLocalState={vi.fn()}
        attachment={{ fileId: "file" }}
        index={0}
      />,
    );

    expect(screen.getByText("File must be processed")).toBeInTheDocument();
  });
});
