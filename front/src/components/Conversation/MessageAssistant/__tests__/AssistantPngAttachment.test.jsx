import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessageAssistant from "../MessageAssistant";
import { loadFile, saveFileReady } from "../../../../db";

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

describe("assistant message with a created png", () => {
  beforeEach(() => openModal.mockClear());

  it("shows the png as a clickable attachment", async () => {
    const bytes = randomPng();
    const fileId = await saveFileReady(
      "conversation-created-png",
      new File([bytes], "random-chart.png", { type: "image/png" }),
    );

    const localState = {
      id: "conversation-created-png",
      settings: {
        model: { id: "vision-model", input: ["image"] },
        enable_tools: true,
      },
      messages: [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Here is the chart you asked for." },
            // What runAgent turns a written png into (see agent/writtenFiles.ts).
            { type: "file", fileId },
          ],
        },
      ],
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
    const image = await screen.findByAltText("random-chart.png");
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
        previewFile: expect.objectContaining({
          name: "random-chart.png",
          type: "image/png",
        }),
      }),
    );
  });
});
