import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessageAssistant from "../MessageAssistant";
import { loadFile, saveFileReady } from "../../../../db";
import { createWrittenFiles } from "../../../../agent/writtenFiles";
import { captureDownloads } from "../../../../test/downloads";

const { openModal, confirmAction } = vi.hoisted(() => ({
  openModal: vi.fn(),
  confirmAction: vi.fn(),
}));

vi.mock("../../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal, confirmAction }),
}));
vi.mock("../../../../hooks/useSendMessage", () => ({
  useSendMessage: () => vi.fn(),
}));
vi.mock("../../../../hooks/useForkConversation", () => ({
  useForkConversation: () => ({ forkConversation: vi.fn() }),
}));
vi.mock("../../../../hooks/useAttachments", () => ({
  useAttachments: () => ({
    removeAttachment: vi.fn(),
    clearAttachments: vi.fn(),
    readFileAsBase64: vi.fn(),
  }),
}));
vi.mock("../../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("../../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => true,
}));
vi.mock("../../../../agent/prepare", () => ({
  usePrepareStatus: () => undefined,
}));
vi.mock("../../../../apis/processFile", () => ({ processFile: vi.fn() }));
vi.mock("../../../../utils/browserDocumentConversion", () => ({
  canConvertDocumentLocally: () => true,
  convertDocumentLocally: vi.fn(),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({ user_settings: {}, interface_settings: {} }),
}));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A png with a real signature and random payload, as the agent's file tools would create it. */
const randomPng = (size = 128) => {
  const bytes = new Uint8Array(PNG_SIGNATURE.length + size);
  bytes.set(PNG_SIGNATURE);
  crypto.getRandomValues(bytes.subarray(PNG_SIGNATURE.length));
  return bytes;
};

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

describe("assistant message with a png", () => {
  beforeEach(() => openModal.mockClear());

  // Renders the message, checks the thumbnail, its bytes and the preview modal.
  const expectClickablePng = async ({ conversationId, content, name, bytes, fileId }) => {
    const localState = {
      id: conversationId,
      settings: {
        model: { id: "vision-model", input: ["image"] },
        enable_tools: true,
      },
      messages: [{ role: "assistant", content }],
    };

    render(
      <MessageAssistant
        localState={localState}
        setLocalState={vi.fn()}
        message_index={0}
        modelsData={[]}
      />,
    );

    expect(await screen.findByText("Here is the chart you asked for.")).toBeInTheDocument();
    const image = await screen.findByAltText(name);
    // useFileBase64 loads the bytes after the metadata, so the src arrives a tick later.
    await waitFor(() =>
      expect(image.getAttribute("src")).toBe(`data:image/png;base64,${toBase64(bytes)}`),
    );

    // The attachment holds the complete png, not a truncated thumbnail.
    const saved = await loadFile(fileId);
    expect(new Uint8Array(await saved.arrayBuffer())).toEqual(bytes);

    // Clicking the attachment opens it in the preview modal.
    fireEvent.click(image);
    expect(openModal).toHaveBeenCalledWith(
      "preview",
      expect.objectContaining({
        fileId,
        previewFile: expect.objectContaining({ name, type: "image/png" }),
      }),
    );
  };

  it("shows a created png as a clickable attachment", async () => {
    const bytes = randomPng();
    const fileId = await saveFileReady(
      "conversation-created-png",
      new File([bytes], "random-chart.png", { type: "image/png" }),
    );

    await expectClickablePng({
      conversationId: "conversation-created-png",
      content: [
        { type: "text", text: "Here is the chart you asked for." },
        // What runAgent turns a written png into (see agent/writtenFiles.ts).
        { type: "file", fileId },
      ],
      name: "random-chart.png",
      bytes,
      fileId,
    });
  });

  it("downloads a png the model created with its complete content", async () => {
    const bytes = randomPng();
    const files = createWrittenFiles("conversation-downloaded-png", {
      readFile: async () => bytes,
    });
    // What runAgent reports after a file tool wrote the image.
    files.observe({ path: "/generated/random-chart.png", kind: "write" });
    await files.save();
    const [item] = files.items();

    render(
      <MessageAssistant
        localState={{
          id: "conversation-downloaded-png",
          settings: {
            model: { id: "vision-model", input: ["image"] },
            enable_tools: true,
          },
          messages: [
            {
              role: "assistant",
              content: [
                { type: "text", text: "Here is the chart you asked for." },
                item,
              ],
            },
          ],
        }}
        setLocalState={vi.fn()}
        message_index={0}
        modelsData={[]}
      />,
    );

    await screen.findByAltText("random-chart.png");
    // The card only appears once the metadata is stored; wait for the bytes too, because the
    // download reads them from IndexedDB.
    await waitFor(async () => {
      const saved = await loadFile(item.fileId);
      expect(saved).not.toBeNull();
      expect(new Uint8Array(await saved.arrayBuffer())).toEqual(bytes);
    });

    const downloads = captureDownloads();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Download file" }));
      await waitFor(() => expect(downloads.blobs).toHaveLength(1));
      expect(await downloads.bytes()).toEqual(bytes);
      expect(downloads.links()[0].download).toBe("random-chart.png");
    } finally {
      downloads.restore();
    }
  });

  it("shows a png the agent read as the same clickable attachment", async () => {    const bytes = randomPng();
    const files = createWrittenFiles("conversation-read-png", {
      readFile: async () => {
        throw new Error("the tool result contains the image");
      },
    });
    // What runAgent does with the image block of a tool result, e.g. pi's read.
    await files.attachImage({
      path: "/charts/read-chart.png",
      data: toBase64(bytes),
      mimeType: "image/png",
    });
    const [item] = files.items();

    await expectClickablePng({
      conversationId: "conversation-read-png",
      content: [
        { type: "text", text: "Here is the chart you asked for." },
        item,
      ],
      name: "read-chart.png",
      bytes,
      fileId: item.fileId,
    });
  });
});
