import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Attachment from "../Attachment";

vi.mock("../../../db", () => ({
  useFileMeta: () => ({ name: "document.pdf", type: "application/pdf", size: 1024 }),
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
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
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
