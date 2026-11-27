import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncConversation } from "../useSyncConversation";
import { CONVERSATION_MOVED_EVENT } from "../../utils/conversationEvents";

const dbMocks = vi.hoisted(() => ({
  getConversation: vi.fn(),
  updateConversation: vi.fn(async () => 1),
  createConversation: vi.fn(),
  getConversationMeta: vi.fn(),
  getLastModifiedConversationMeta: vi.fn(),
}));

vi.mock("../../db", () => dbMocks);

const modalMocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  /** The query string the mocked `useSearchParams` hands the hook. */
  params: [],
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(routerMocks.params), vi.fn()],
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
  useModal: () => modalMocks,
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

describe("useSyncConversation Arcana share links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.params = [];
  });

  it("wires the chat to the access link's collection and persists both bindings", async () => {
    routerMocks.params = [["arcana", "alice/papers"]];
    const conversation = {
      ...makeConversation([{ role: "user", content: [{ type: "text", text: "" }] }]),
      title: "Untitled Chat",
      hasFirstPrompt: false,
    };
    dbMocks.updateConversation.mockResolvedValue(456);
    const setLocalState = renderSync(conversation);

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    const state = lastState(setLocalState);
    expect(state.settings.arcana_share).toEqual({
      collection: "alice/papers",
      owner: "alice",
      name: "papers",
    });
    // The Arcana tool keeps the readable Arcana ID the link carried.
    expect(state.settings.arcana).toEqual({ id: "alice/papers" });
    // The agent tools are only offered while tools are enabled.
    expect(state.settings.enable_tools).toBe(true);
    // A chat the share link created is named after the collection.
    expect(state.title).toBe("papers");

    await waitFor(() => expect(dbMocks.updateConversation).toHaveBeenCalled());
    const payload = dbMocks.updateConversation.mock.calls.at(-1)[1];
    expect(payload.settings.arcana_share.collection).toBe("alice/papers");
    expect(payload.settings.arcana.id).toBe("alice/papers");
    // The optimistic-concurrency token is threaded through.
    expect(payload.lastModified).toBe(123);
  });

  it("still accepts the older arcana_share param", async () => {
    routerMocks.params = [["arcana_share", "alice__papers"]];
    const setLocalState = renderSync(makeConversation([]));

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    const state = lastState(setLocalState);
    expect(state.settings.arcana_share.collection).toBe("alice/papers");
    expect(state.settings.arcana.id).toBe("alice/papers");
    expect(state.settings.enable_tools).toBe(true);
  });

  it("leaves a chat that already has a title alone", async () => {
    routerMocks.params = [["arcana", "alice/papers"]];
    const setLocalState = renderSync(makeConversation([]));

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    const state = lastState(setLocalState);
    expect(state.title).toBe("Chat");
    expect(state.settings.arcana_share.collection).toBe("alice/papers");
  });

  it("keeps a plain Arcana ID as the tool's field only", async () => {
    routerMocks.params = [["arcana", "papers"]];
    const setLocalState = renderSync(makeConversation([]));

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    // An id without an owner is not a share ref, so no read-only binding and
    // no forced tool switch; it only feeds the Arcana tool's own field.
    const state = lastState(setLocalState);
    expect(state.settings.arcana).toEqual({ id: "papers" });
    expect(state.settings.arcana_share).toBeUndefined();
  });

  it("ignores a share value that is not a collection reference", async () => {
    routerMocks.params = [["arcana_share", "papers"]];
    const setLocalState = renderSync(makeConversation([]));

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());

    // The unrelated branch still applies query settings, but adds no binding.
    expect(lastState(setLocalState).settings.arcana_share).toBeUndefined();
    expect(dbMocks.updateConversation).not.toHaveBeenCalled();
  });
});

describe("useSyncConversation topic moves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modalMocks.openModal.mockClear();
  });

  function renderStatefulSync(conversation) {
    dbMocks.getConversation.mockResolvedValue(conversation);
    const seen = { state: null };
    renderHook(() => {
      const [localState, setLocalState] = useState(null);
      seen.state = localState;
      useSyncConversation({ localState, setLocalState, conversationId });
      return localState;
    });
    return seen;
  }

  it("adopts a move made elsewhere instead of reporting a conflict", async () => {
    dbMocks.updateConversation.mockResolvedValue(5000);
    const conversation = makeConversation([
      { role: "user", content: [{ type: "text", text: "keep me" }] },
    ]);
    const seen = renderStatefulSync(conversation);

    await waitFor(() => expect(seen.state?.id).toBe(conversationId));
    dbMocks.updateConversation.mockClear();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(CONVERSATION_MOVED_EVENT, {
          detail: { conversationId, folderId: "topic-b", lastModified: 4242 },
        }),
      );
    });

    await waitFor(() => expect(seen.state?.folderId).toBe("topic-b"));
    await waitFor(
      () => expect(dbMocks.updateConversation).toHaveBeenCalled(),
      { timeout: 4000 },
    );

    const payloads = dbMocks.updateConversation.mock.calls.map((call) => call[1]);
    expect(payloads.some((payload) => payload.lastModified === 4242)).toBe(true);
    // The chat page owns the message list, never the topic it was moved to.
    expect(payloads.every((payload) => !("folderId" in payload))).toBe(true);
    expect(modalMocks.openModal).not.toHaveBeenCalled();
  });
});
