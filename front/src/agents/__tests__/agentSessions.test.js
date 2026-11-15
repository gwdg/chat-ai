import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchAgentSessions,
  mergeMessageHistory,
  syncSessionHistory,
} from "../agentSessions";
import { db } from "../../db";
import {
  loadAgentSessions,
  saveAgentSessions,
} from "../../db/agentSessionCache";

const apiMocks = vi.hoisted(() => ({
  page: vi.fn(),
  full: vi.fn(),
  sessions: vi.fn(),
  children: vi.fn(),
}));

vi.mock("../../apis/opencodeAgents", () => ({
  createOpencodeSession: vi.fn(),
  deleteOpencodeSession: vi.fn(),
  listOpencodeMessages: (...args) => apiMocks.full(...args),
  listOpencodeMessagesPage: (...args) => apiMocks.page(...args),
  listOpencodeSessionChildren: (...args) => apiMocks.children(...args),
  listOpencodeSessions: (...args) => apiMocks.sessions(...args),
}));

const message = (id, extra = {}) => ({ id, type: "user", text: id, ...extra });
const agent = { id: "agent-1" };

beforeEach(async () => {
  apiMocks.page.mockReset();
  apiMocks.full.mockReset();
  apiMocks.sessions.mockReset();
  apiMocks.children.mockReset();
  await db.agent_sessions.clear();
  await db.agent_session_messages.clear();
});

describe("mergeMessageHistory", () => {
  it("uses the downloaded history when nothing is cached", () => {
    const fetched = [message("a"), message("b")];
    const merged = mergeMessageHistory([], fetched, null);
    expect(merged.messages).toEqual(fetched);
    expect(merged.replace).toBe(true);
  });

  it("keeps the cached prefix and replaces the anchor with the new tail", () => {
    const cached = [message("a"), message("b"), message("c")];
    const fetched = [message("c", { text: "c updated" }), message("d")];

    const merged = mergeMessageHistory(cached, fetched, "c");

    expect(merged.messages.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(merged.messages[2].text).toBe("c updated");
    expect(merged.changed.map((item) => item.id)).toEqual(["c", "d"]);
    expect(merged.startIndex).toBe(2);
    expect(merged.replace).toBe(false);
  });

  it("replaces the cache when the anchor is gone", () => {
    const cached = [message("a"), message("b")];
    const fetched = [message("x"), message("y")];

    const merged = mergeMessageHistory(cached, fetched, "b");

    expect(merged.messages).toEqual(fetched);
    expect(merged.replace).toBe(true);
  });

  it("asks for the full history when the window ends before the anchor", () => {
    const cached = [message("a"), message("b")];
    const fetched = [message("x"), message("y")];

    const merged = mergeMessageHistory(cached, fetched, "b", false);

    expect(merged.messages).toEqual(cached);
    expect(merged.needsFullHistory).toBe(true);
    expect(merged.replace).toBe(false);
  });

  it("leaves the cache alone when the server returned nothing yet", () => {
    const cached = [message("a")];
    const merged = mergeMessageHistory(cached, [], null);
    expect(merged.messages).toEqual(cached);
    expect(merged.replace).toBe(false);
  });
});

describe("syncSessionHistory", () => {
  it("merges only the new tail when the cached anchor is present", async () => {
    apiMocks.page.mockResolvedValue({
      messages: [message("c", { text: "edited" }), message("d")],
      complete: true,
    });
    const cached = [message("a"), message("b"), message("c")];

    const synced = await syncSessionHistory(agent, "s1", cached, "c");

    expect(synced.messages.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(synced.messages[2].text).toBe("edited");
    expect(synced.changed.map((item) => item.id)).toEqual(["c", "d"]);
    expect(synced.replace).toBe(false);
    expect(synced.lastMessageId).toBe("d");
    expect(apiMocks.full).not.toHaveBeenCalled();
  });

  it("replaces the cache when a revert removed the anchor", async () => {
    apiMocks.page.mockResolvedValue({
      messages: [message("a")],
      complete: true,
    });

    const synced = await syncSessionHistory(
      agent,
      "s1",
      [message("a"), message("b")],
      "b",
    );

    expect(synced.messages.map((item) => item.id)).toEqual(["a"]);
    expect(synced.replace).toBe(true);
    expect(synced.lastMessageId).toBe("a");
    expect(apiMocks.full).not.toHaveBeenCalled();
  });

  it("drops the cache once the server confirms a cleared session", async () => {
    apiMocks.page.mockResolvedValue({ messages: [], complete: true });
    apiMocks.full.mockResolvedValue([]);

    const synced = await syncSessionHistory(
      agent,
      "s1",
      [message("a"), message("b")],
      "b",
    );

    expect(synced.messages).toEqual([]);
    expect(synced.replace).toBe(true);
    expect(synced.lastMessageId).toBeNull();
    expect(apiMocks.full).toHaveBeenCalledTimes(1);
  });

  it("keeps the history when only an empty page came back", async () => {
    apiMocks.page.mockResolvedValue({ messages: [], complete: true });
    apiMocks.full.mockResolvedValue([message("a"), message("b")]);

    const synced = await syncSessionHistory(
      agent,
      "s1",
      [message("a"), message("b")],
      "b",
    );

    expect(synced.messages.map((item) => item.id)).toEqual(["a", "b"]);
    expect(synced.replace).toBe(true);
    expect(apiMocks.full).toHaveBeenCalledTimes(1);
  });

  it("re-reads everything when the page window ends before the anchor", async () => {
    apiMocks.page.mockResolvedValue({
      messages: [message("x"), message("y")],
      complete: false,
    });
    apiMocks.full.mockResolvedValue([
      message("a"),
      message("b"),
      message("x"),
      message("y"),
    ]);

    const synced = await syncSessionHistory(
      agent,
      "s1",
      [message("a"), message("b")],
      "b",
    );

    expect(apiMocks.full).toHaveBeenCalledWith(agent, "s1");
    expect(synced.messages.map((item) => item.id)).toEqual([
      "a",
      "b",
      "x",
      "y",
    ]);
    expect(synced.replace).toBe(true);
  });

  it("keeps a restored transcript when the server timeline is empty", async () => {
    apiMocks.page.mockResolvedValue({ messages: [], complete: true });
    apiMocks.full.mockResolvedValue([]);

    const synced = await syncSessionHistory(
      agent,
      "s1",
      [message("a"), message("b")],
      "b",
      { keepWhenEmpty: true },
    );

    expect(synced.messages.map((item) => item.id)).toEqual(["a", "b"]);
    expect(synced.replace).toBe(false);
    expect(synced.changed).toEqual([]);
  });

  it("keeps a restored transcript on a stale full read too", async () => {
    apiMocks.full.mockResolvedValue([]);

    const synced = await syncSessionHistory(
      agent,
      "s1",
      [message("a")],
      "a",
      { full: true, keepWhenEmpty: true },
    );

    expect(synced.messages.map((item) => item.id)).toEqual(["a"]);
    expect(synced.replace).toBe(false);
  });

  it("keeps the cache when the server cannot be reached", async () => {
    apiMocks.page.mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(
      syncSessionHistory(agent, "s1", [message("a")], "a"),
    ).rejects.toThrow(/ECONNREFUSED/);
    expect(apiMocks.full).not.toHaveBeenCalled();
  });

  it("reconciles by id when a full read is requested", async () => {
    apiMocks.full.mockResolvedValue([message("b"), message("c")]);

    const synced = await syncSessionHistory(
      agent,
      "s1",
      [message("a"), message("b")],
      "b",
      { full: true },
    );

    expect(apiMocks.page).not.toHaveBeenCalled();
    // `a` no longer exists on the server, so it must not survive the merge.
    expect(synced.messages.map((item) => item.id)).toEqual(["b", "c"]);
    expect(synced.replace).toBe(true);
  });
});

describe("fetchAgentSessions", () => {
  const cached = async () =>
    (await loadAgentSessions("agent-1")).map((session) => session.id).sort();

  it("prunes cached sessions the server no longer reports", async () => {
    await saveAgentSessions("agent-1", [
      { id: "s1", title: "One" },
      { id: "s2", title: "Two" },
    ]);
    apiMocks.sessions.mockResolvedValue([{ id: "s1", title: "One" }]);
    apiMocks.children.mockResolvedValue([]);

    const tree = await fetchAgentSessions(agent);

    expect(tree.all.map((session) => session.id)).toEqual(["s1"]);
    expect(await cached()).toEqual(["s1"]);
  });

  it("keeps the cache when an empty server lost every session", async () => {
    await saveAgentSessions("agent-1", [
      { id: "s1", title: "One" },
      { id: "s2", title: "Two" },
    ]);
    apiMocks.sessions.mockResolvedValue([]);
    apiMocks.children.mockResolvedValue([]);

    const tree = await fetchAgentSessions(agent);

    expect(tree.all).toEqual([]);
    // The cache is the only copy left, so it must survive for the recovery offer.
    expect(await cached()).toEqual(["s1", "s2"]);
  });

  it("keeps the cache when the listing could not be completed", async () => {
    await saveAgentSessions("agent-1", [
      { id: "s1", title: "One" },
      { id: "s2", title: "Two" },
    ]);
    apiMocks.sessions.mockResolvedValue([{ id: "s1", title: "One" }]);
    apiMocks.children.mockRejectedValue(new Error("boom"));

    await fetchAgentSessions(agent);

    expect(await cached()).toEqual(["s1", "s2"]);
  });

  it("lists cached sessions while the server is unreachable", async () => {
    await saveAgentSessions("agent-1", [{ id: "s1", title: "One" }]);
    apiMocks.sessions.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const tree = await fetchAgentSessions(agent);

    expect(tree.offline).toBe(true);
    expect(tree.all.map((session) => session.id)).toEqual(["s1"]);
  });
});
