import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncConversation } from "../useSyncConversation";

const dbMocks = vi.hoisted(() => ({
  getConversation: vi.fn(),
  updateConversation: vi.fn(async () => 1),
  updateConversationMeta: vi.fn(async () => 0),
  createConversation: vi.fn(),
  getConversationMeta: vi.fn(),
  getLastModifiedConversationMeta: vi.fn(),
}));

vi.mock("../../db", () => dbMocks);

const modalMocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
}));

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
  useModal: () => modalMocks,
}));

vi.mock("../useImportConversation", () => ({
  useImportConversation: () => vi.fn(),
}));

const conversationId = "550e8400-e29b-41d4-a716-446655440000";

function makeConversation() {
  return {
    id: conversationId,
    title: "Chat",
    messages: [
      { role: "system", content: [{ type: "text", text: "system" }] },
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
    ],
    settings: { tools: { create_docx: true } },
    createdAt: 1,
    lastModified: 123,
    folderId: null,
  };
}

function renderStatefulSync() {
  const conversation = makeConversation();
  dbMocks.getConversation.mockResolvedValue(conversation);
  const seen = { state: null, set: null };
  renderHook(() => {
    const [localState, setLocalState] = useState(null);
    seen.state = localState;
    seen.set = setLocalState;
    useSyncConversation({ localState, setLocalState, conversationId });
    return localState;
  });
  return seen;
}

/** Hydrate, then let the initialization effect mark the hydrated list. */
async function renderHydrated() {
  const seen = renderStatefulSync();
  await waitFor(() => expect(seen.state?.id).toBe(conversationId));
  await act(async () => {});
  return seen;
}

function toggleTool(seen, value) {
  act(() => {
    seen.set((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, create_docx: value },
      },
      flush: true,
    }));
  });
}

function appendMessage(seen, patch = {}) {
  act(() => {
    seen.set((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          role: "assistant",
          content: [{ type: "text", text: "streaming" }],
          ...patch,
        },
      ],
      ...(patch.loading ? { ignoreConflict: true } : {}),
      flush: true,
    }));
  });
}

const conflictModal = () =>
  modalMocks.openModal.mock.calls.find((call) => call[0] === "conversationConflict");

describe("useSyncConversation settings conflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.updateConversation.mockResolvedValue(1);
    dbMocks.updateConversationMeta.mockResolvedValue(0);
    dbMocks.getConversationMeta.mockResolvedValue({
      id: conversationId,
      lastModified: 9000,
    });
  });

  it("merges a settings change when another write bumped lastModified", async () => {
    const seen = await renderHydrated();
    // A second tab, a force-save or a sync pull wrote the row: the optimistic
    // concurrency check now answers -1 for this tab's stale token.
    dbMocks.updateConversation.mockResolvedValue(-1);

    toggleTool(seen, false);

    await waitFor(() =>
      expect(dbMocks.updateConversationMeta).toHaveBeenCalled(),
    );
    const [id, updates] = dbMocks.updateConversationMeta.mock.calls.at(-1);
    expect(id).toBe(conversationId);
    expect(updates.settings.tools.create_docx).toBe(false);
    // Only metadata: the other writer's messages and token stay untouched.
    expect(updates).not.toHaveProperty("messages");
    expect(updates).not.toHaveProperty("lastModified");
    // No conflict dialog for a settings-only change.
    expect(conflictModal()).toBeUndefined();
  });

  it("adopts the merged row's token so the next save does not conflict again", async () => {
    const seen = await renderHydrated();
    dbMocks.updateConversation.mockResolvedValue(-1);

    toggleTool(seen, false);
    await waitFor(() =>
      expect(dbMocks.updateConversationMeta).toHaveBeenCalled(),
    );

    // A later successful save must send the token the merge adopted (9000),
    // not the stale one this tab was hydrated with (123).
    dbMocks.updateConversation.mockResolvedValue(9001);
    toggleTool(seen, true);

    await waitFor(() =>
      expect(dbMocks.updateConversation).toHaveBeenLastCalledWith(
        conversationId,
        expect.objectContaining({ lastModified: 9000 }),
      ),
    );
  });

  it("still asks when the message list itself changed", async () => {
    const seen = await renderHydrated();
    dbMocks.updateConversation.mockResolvedValue(-1);

    appendMessage(seen);

    await waitFor(() => expect(conflictModal()).toBeTruthy());
    expect(dbMocks.updateConversationMeta).not.toHaveBeenCalled();
  });

  it("does not let a stale streaming flag hide a later conflict", async () => {
    const seen = await renderHydrated();
    dbMocks.updateConversation.mockResolvedValue(-1);

    // `sendMessage` leaves `ignoreConflict: true` in React state after the turn.
    // The assistant message is no longer loading, so the flag must not apply.
    act(() => {
      seen.set((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { role: "user", content: [{ type: "text", text: "next" }] },
        ],
        ignoreConflict: true,
        flush: true,
      }));
    });

    await waitFor(() => expect(conflictModal()).toBeTruthy());
  });

  it("tolerates a conflict while an assistant message is still streaming", async () => {
    const seen = await renderHydrated();
    dbMocks.updateConversation.mockResolvedValue(-1);

    appendMessage(seen, { loading: true });

    await waitFor(() => expect(dbMocks.updateConversation).toHaveBeenCalled());
    // The next chunk saves again, so this conflict is expected and quiet.
    expect(conflictModal()).toBeUndefined();
    expect(dbMocks.updateConversationMeta).not.toHaveBeenCalled();
  });

  it("leaves a deleted conversation to the conflict dialog", async () => {
    const seen = await renderHydrated();
    dbMocks.updateConversation.mockResolvedValue(-1);
    dbMocks.getConversationMeta.mockResolvedValue(undefined);

    toggleTool(seen, false);

    await waitFor(() => expect(conflictModal()).toBeTruthy());
    expect(dbMocks.updateConversationMeta).not.toHaveBeenCalled();
  });
});
