import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SummarizeChatModal from "../SummarizeChatModal";

const mocks = vi.hoisted(() => ({
  release: null,
  gate: null,
  navigate: vi.fn(),
  createConversation: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: () => 300000,
}));
vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("../../../db", () => ({
  createConversation: (...args) => mocks.createConversation(...args),
}));
vi.mock("../../../utils/sendMessage", () => ({
  buildConversationForAPI: async (state) => state,
}));
vi.mock("../../../apis/chatCompletions", () => ({
  chatCompletions: async function* () {
    yield { choices: [{ delta: { content: "Summary" } }] };
    await mocks.gate;
    yield { choices: [{ delta: { content: " about trains." } }] };
  },
}));

const localState = {
  id: "c1",
  title: "Trains",
  folderId: null,
  settings: { model: { id: "test-model" } },
  messages: [
    { role: "system", content: [{ type: "text", text: "You are helpful." }] },
    { role: "user", content: [{ type: "text", text: "Trains?" }] },
    { role: "assistant", content: [{ type: "text", text: "Sure." }] },
    { role: "user", content: [{ type: "text", text: "" }] },
  ],
};

describe("SummarizeChatModal progress", () => {
  beforeEach(() => {
    mocks.createConversation.mockReset();
    mocks.createConversation.mockResolvedValue("summary-1");
    mocks.navigate.mockReset();
    mocks.gate = new Promise((resolve) => {
      mocks.release = resolve;
    });
  });

  it("shows how much of the summary already arrived", async () => {
    render(
      <SummarizeChatModal
        isOpen
        onClose={() => {}}
        localState={localState}
      />,
    );

    expect(await screen.findByText(/Received 1 word…/)).toBeInTheDocument();

    await act(async () => {
      mocks.release();
    });

    expect(
      await screen.findByText("Summary created in a new conversation."),
    ).toBeInTheDocument();
  });
});
