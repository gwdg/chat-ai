import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createConversation: vi.fn(async () => "plain-chat"),
  createAttachedChat: vi.fn(async () => "workspace-chat"),
}));

vi.mock("../../db", () => ({
  createConversation: mocks.createConversation,
}));

vi.mock("../../db/workspaceDb", () => ({
  createAttachedChat: mocks.createAttachedChat,
}));

import { createNewChatConversation } from "../newChat";

const conversation = { title: "New chat" } as never;

describe("createNewChatConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the chat in the selected workspace", async () => {
    const result = await createNewChatConversation("ws-1", conversation);

    expect(mocks.createAttachedChat).toHaveBeenCalledWith("ws-1", conversation);
    expect(mocks.createConversation).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "workspace-chat", attached: true });
  });

  it("creates an unassigned chat without a selected workspace", async () => {
    const result = await createNewChatConversation(null, conversation);

    expect(mocks.createConversation).toHaveBeenCalledWith(conversation);
    expect(mocks.createAttachedChat).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "plain-chat", attached: false });
  });
});
