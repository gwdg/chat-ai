import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apis/opencodeAgents", () => ({
  opencodeDefaults: () => ({
    serverUrl: "http://localhost:9999",
    username: "opencode",
    password: "secret",
  }),
}));

const STORAGE_KEY = "chatai.agents";

// The store keeps its rows in module state and reads localStorage on import,
// so every test gets a fresh module instance.
const freshStore = async () => {
  vi.resetModules();
  return import("../agentStore");
};

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("agentStore timestamps", () => {
  it("stamps new agents with a creation and modification time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const store = await freshStore();

    store.addAgent({ id: "a1", name: "Agent", serverUrl: "http://x" });

    expect(store.getAgent("a1")).toMatchObject({
      createdAt: Date.UTC(2026, 0, 1, 10),
      updatedAt: Date.UTC(2026, 0, 1, 10),
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved[0].createdAt).toBe(Date.UTC(2026, 0, 1, 10));
  });

  it("backfills missing timestamps once and persists them", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: "a1", name: "Legacy", serverUrl: "http://x" }]),
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-03T04:05:06Z"));
    const store = await freshStore();

    const agent = store.getAgent("a1");
    expect(agent.createdAt).toBe(Date.UTC(2026, 1, 3, 4, 5, 6));
    expect(agent.updatedAt).toBe(agent.createdAt);

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved[0].createdAt).toBe(agent.createdAt);
    expect(saved[0].updatedAt).toBe(agent.updatedAt);
  });

  it("bumps the modification time for metadata but not for session tracking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    const store = await freshStore();
    store.addAgent({ id: "a1", name: "Agent", serverUrl: "http://x" });
    const createdAt = store.getAgent("a1").createdAt;

    vi.setSystemTime(new Date("2026-03-02T00:00:00Z"));
    store.updateAgent("a1", { name: "Renamed" });
    const renamed = store.getAgent("a1");
    expect(renamed.updatedAt).toBe(Date.UTC(2026, 2, 2));
    expect(renamed.createdAt).toBe(createdAt);

    store.updateAgent("a1", { sessionId: "session-1" });
    expect(store.getAgent("a1").updatedAt).toBe(Date.UTC(2026, 2, 2));

    store.updateAgent("a1", { sessionSummaries: { "s-1": "Summary" } });
    expect(store.getAgent("a1").updatedAt).toBe(Date.UTC(2026, 2, 2));
  });

  it("pins and unpins an agent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
    const store = await freshStore();
    store.addAgent({ id: "a1", name: "Agent", serverUrl: "http://x" });

    vi.setSystemTime(new Date("2026-04-02T00:00:00Z"));
    store.setAgentPinned("a1", true);
    expect(store.getAgent("a1").pinned).toBe(true);
    expect(store.getAgent("a1").updatedAt).toBe(Date.UTC(2026, 3, 2));

    store.setAgentPinned("a1", false);
    expect(store.getAgent("a1").pinned).toBe(false);
  });
});

describe("agentStore sync apply", () => {
  // A pull must not look like a local edit: the record's `updatedAt` is adopted
  // as-is, so the next `list()` produces the payload that was just pulled.
  it("keeps the synced modification time instead of bumping it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    const store = await freshStore();
    store.addAgent({
      id: "a1",
      name: "Agent",
      serverUrl: "http://x",
      createdAt: Date.UTC(2026, 4, 1),
      updatedAt: Date.UTC(2026, 4, 1),
    });

    vi.setSystemTime(new Date("2026-05-09T00:00:00Z"));
    store.applyAgentFromSync({
      id: "a1",
      name: "Renamed elsewhere",
      serverUrl: "http://x",
      createdAt: Date.UTC(2026, 4, 1),
      updatedAt: Date.UTC(2026, 4, 2),
    });

    const agent = store.getAgent("a1");
    expect(agent.name).toBe("Renamed elsewhere");
    expect(agent.updatedAt).toBe(Date.UTC(2026, 4, 2));
    expect(agent.createdAt).toBe(Date.UTC(2026, 4, 1));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved[0].updatedAt).toBe(Date.UTC(2026, 4, 2));
  });

  it("keeps the device's active session when the record does not carry one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    const store = await freshStore();
    store.addAgent({ id: "a1", name: "Agent", serverUrl: "http://x" });
    store.updateAgent("a1", { sessionId: "local-session" });

    store.applyAgentFromSync({
      id: "a1",
      name: "Remote name",
      serverUrl: "http://x",
      createdAt: Date.UTC(2026, 5, 1),
      updatedAt: Date.UTC(2026, 5, 2),
    });

    expect(store.getAgent("a1")).toMatchObject({
      name: "Remote name",
      sessionId: "local-session",
    });
  });

  it("adds an agent it has never seen with the record's timestamps", async () => {
    const store = await freshStore();
    store.applyAgentFromSync({
      id: "a2",
      name: "From the account",
      serverUrl: "http://x",
      createdAt: 111,
      updatedAt: 222,
    });

    expect(store.getAgent("a2")).toMatchObject({
      name: "From the account",
      createdAt: 111,
      updatedAt: 222,
    });
  });
});
