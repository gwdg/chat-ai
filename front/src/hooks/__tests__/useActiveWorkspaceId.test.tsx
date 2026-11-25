import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  params: {} as { workspaceId?: string },
  links: [] as { workspaceId: string; conversationId: string; createdAt: number }[],
}));

vi.mock("react-router", () => ({
  useParams: () => mocks.params,
}));

vi.mock("../../db/workspaceDb", () => ({
  useChatWorkspaces: () => mocks.links,
}));

import { useActiveWorkspaceId } from "../useActiveWorkspaceId";

describe("useActiveWorkspaceId", () => {
  beforeEach(() => {
    mocks.params = {};
    mocks.links = [];
  });

  it("prefers the open workspace page", () => {
    mocks.params = { workspaceId: "ws-page" };
    mocks.links = [
      { workspaceId: "ws-chat", conversationId: "chat-1", createdAt: 1 },
    ];

    const { result } = renderHook(() => useActiveWorkspaceId("chat-1"));

    expect(result.current).toBe("ws-page");
  });

  it("uses the workspace of the open chat", () => {
    mocks.links = [
      { workspaceId: "ws-chat", conversationId: "chat-1", createdAt: 7 },
    ];

    const { result } = renderHook(() => useActiveWorkspaceId("chat-1"));

    expect(result.current).toBe("ws-chat");
  });

  it("takes the oldest link when the chat belongs to several workspaces", () => {
    mocks.links = [
      { workspaceId: "newer", conversationId: "chat-1", createdAt: 20 },
      { workspaceId: "older", conversationId: "chat-1", createdAt: 10 },
    ];

    const { result } = renderHook(() => useActiveWorkspaceId("chat-1"));

    expect(result.current).toBe("older");
  });

  it("is null without a selected workspace", () => {
    const { result } = renderHook(() => useActiveWorkspaceId(undefined));

    expect(result.current).toBeNull();
  });
});
