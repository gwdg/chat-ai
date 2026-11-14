import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncConversation } from "../useSyncConversation";

const dbMocks = vi.hoisted(() => ({
  getConversation: vi.fn(),
  updateConversation: vi.fn(async () => 1),
  createConversation: vi.fn(),
  getConversationMeta: vi.fn(),
  getLastModifiedConversationMeta: vi.fn(),
}));

vi.mock("../../db", () => dbMocks);

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({
      user_settings: {},
      interface_settings: {},
      last_conversation: null,
      migration_data: null,
    }),
  useDispatch: () => vi.fn(),
}));

vi.mock("../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

vi.mock("../useImportConversation", () => ({
  useImportConversation: () => vi.fn(),
}));

const conversationId = "550e8400-e29b-41d4-a716-446655440000";

function makeConversation(messages) {
  return {
    id: conversationId,
    title: "Chat",
    messages,
    settings: {},
    createdAt: 1,
    lastModified: 123,
    folderId: null,
  };
}

function renderSync(conversation) {
  dbMocks.getConversation.mockResolvedValue(conversation);
  const setLocalState = vi.fn();
  renderHook(() =>
    useSyncConversation({ localState: null, setLocalState, conversationId }),
  );
  return setLocalState;
}

function lastState(setLocalState) {
  return setLocalState.mock.calls.at(-1)[0];
}

describe("useSyncConversation hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a stored user message instead of replacing it with defaults", async () => {
    const conversation = makeConversation([
      { role: "user", content: [{ type: "text", text: "keep me" }] },
    ]);
    const setLocalState = renderSync(conversation);

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    const state = lastState(setLocalState);
    expect(state.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(state.messages[1].content[0].text).toBe("keep me");
  });

  it("keeps a custom system prompt and adds the prompt placeholder", async () => {
    const conversation = makeConversation([
      { role: "system", content: [{ type: "text", text: "custom system" }] },
    ]);
    const setLocalState = renderSync(conversation);

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    const state = lastState(setLocalState);
    expect(state.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(state.messages[0].content[0].text).toBe("custom system");
  });

  it("fills an empty conversation with the default system and prompt messages", async () => {
    const conversation = makeConversation([]);
    const setLocalState = renderSync(conversation);

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    const state = lastState(setLocalState);
    expect(state.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(state.messages[0].content[0].text).toBe(
      "You are a helpful assistant.",
    );
    expect(state.messages[1].content[0].text).toBe("");
  });

  it("passes a complete conversation through unchanged", async () => {
    const conversation = makeConversation([
      { role: "system", content: [{ type: "text", text: "system" }] },
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
    ]);
    const setLocalState = renderSync(conversation);

    await waitFor(() => expect(setLocalState).toHaveBeenCalledWith(conversation));
  });
});
