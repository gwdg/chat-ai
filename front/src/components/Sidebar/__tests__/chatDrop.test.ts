import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assign: vi.fn(async () => 1),
  attach: vi.fn(async () => {}),
  detach: vi.fn(async () => {}),
}));

vi.mock("../../../db", () => ({
  assignConversationToFolder: (...args: any[]) => mocks.assign(...args),
}));
vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceChat: (...args: any[]) => mocks.attach(...args),
  detachWorkspaceChat: (...args: any[]) => mocks.detach(...args),
}));

import {
  CHAT_DRAG_MIME,
  CHAT_SOURCE_WORKSPACE_MIME,
  dropConversationOnTopic,
  dropConversationOnWorkspace,
  isChatDrag,
  readChatDrag,
  setChatDragData,
} from "../chatDrop";

// jsdom has no working DataTransfer, so the helpers get a small stand-in with
// the three members they use.
const makeDataTransfer = (entries: Record<string, string> = {}) => {
  const data = new Map(Object.entries(entries));
  return {
    typeList: data,
    get types() {
      return [...data.keys()];
    },
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
    effectAllowed: "none",
    dropEffect: "none",
  } as unknown as DataTransfer;
};

beforeEach(() => {
  mocks.assign.mockReset().mockResolvedValue(1);
  mocks.attach.mockReset().mockResolvedValue(undefined);
  mocks.detach.mockReset().mockResolvedValue(undefined);
});

describe("chat drag payload", () => {
  it("writes the chat id under the private MIME and keeps text/plain readable", () => {
    const dataTransfer = makeDataTransfer();
    setChatDragData(dataTransfer, "chat-1");

    expect(dataTransfer.getData(CHAT_DRAG_MIME)).toBe("chat-1");
    expect(dataTransfer.getData("text/plain")).toBe("chat-1");
    expect(dataTransfer.getData(CHAT_SOURCE_WORKSPACE_MIME)).toBe("");
    expect(dataTransfer.effectAllowed).toBe("move");
  });

  it("remembers the workspace a chat row was dragged out of", () => {
    const dataTransfer = makeDataTransfer();
    setChatDragData(dataTransfer, "chat-1", "ws-1");

    expect(readChatDrag(dataTransfer)).toEqual({
      conversationId: "chat-1",
      workspaceId: "ws-1",
    });
  });

  it("only recognises its own drags as chat drags", () => {
    expect(isChatDrag(makeDataTransfer({ Files: "" }))).toBe(false);
    expect(isChatDrag(makeDataTransfer({ "text/plain": "chat-1" }))).toBe(false);
    expect(isChatDrag(makeDataTransfer({ [CHAT_DRAG_MIME]: "chat-1" }))).toBe(
      true,
    );
    expect(isChatDrag(null)).toBe(false);
  });

  it("reads a plain text drag as a chat id with no source workspace", () => {
    expect(readChatDrag(makeDataTransfer({ "text/plain": "chat-1" }))).toEqual({
      conversationId: "chat-1",
      workspaceId: null,
    });
    expect(readChatDrag(null)).toBeNull();
  });
});

describe("dropConversationOnTopic", () => {
  it("moves a chat into another topic", async () => {
    await dropConversationOnTopic({
      conversationId: "chat-1",
      currentFolderId: null,
      targetFolderId: "topic-b",
    });

    expect(mocks.assign).toHaveBeenCalledWith("chat-1", "topic-b");
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("does not rewrite a chat that already sits in the topic", async () => {
    await dropConversationOnTopic({
      conversationId: "chat-1",
      currentFolderId: "topic-b",
      targetFolderId: "topic-b",
    });

    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("detaches a chat dragged out of a workspace even in the same topic", async () => {
    await dropConversationOnTopic({
      conversationId: "chat-1",
      currentFolderId: "topic-b",
      targetFolderId: "topic-b",
      sourceWorkspaceId: "ws-1",
    });

    expect(mocks.detach).toHaveBeenCalledWith("ws-1", "chat-1");
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("detaches and moves in one drop", async () => {
    await dropConversationOnTopic({
      conversationId: "chat-1",
      currentFolderId: "topic-a",
      targetFolderId: "topic-b",
      sourceWorkspaceId: "ws-1",
    });

    expect(mocks.detach).toHaveBeenCalledWith("ws-1", "chat-1");
    expect(mocks.assign).toHaveBeenCalledWith("chat-1", "topic-b");
  });
});

describe("dropConversationOnWorkspace", () => {
  it("attaches a chat from the ordinary chat list", async () => {
    await dropConversationOnWorkspace({
      conversationId: "chat-1",
      targetWorkspaceId: "ws-1",
      sourceWorkspaceId: null,
    });

    expect(mocks.attach).toHaveBeenCalledWith("ws-1", "chat-1");
    expect(mocks.detach).not.toHaveBeenCalled();
  });

  it("moves a chat out of the workspace it came from", async () => {
    await dropConversationOnWorkspace({
      conversationId: "chat-1",
      targetWorkspaceId: "ws-2",
      sourceWorkspaceId: "ws-1",
    });

    expect(mocks.detach).toHaveBeenCalledWith("ws-1", "chat-1");
    expect(mocks.attach).toHaveBeenCalledWith("ws-2", "chat-1");
  });

  it("keeps a chat attached when it is dropped on its own workspace", async () => {
    await dropConversationOnWorkspace({
      conversationId: "chat-1",
      targetWorkspaceId: "ws-1",
      sourceWorkspaceId: "ws-1",
    });

    expect(mocks.detach).not.toHaveBeenCalled();
    expect(mocks.attach).toHaveBeenCalledWith("ws-1", "chat-1");
  });
});
