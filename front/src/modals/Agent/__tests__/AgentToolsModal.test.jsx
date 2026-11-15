import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentToolsModal from "../AgentToolsModal";

const mocks = vi.hoisted(() => ({
  listMessages: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  writeInstruction: vi.fn(),
  loadCache: vi.fn(),
  switchSession: vi.fn(),
  notifySessions: vi.fn(),
  notifyHistory: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../BaseModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: mocks.success, notifyError: mocks.error }),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({ user_settings: { mcp_servers: [] } }),
}));
vi.mock("../../../apis/opencodeAgents", () => ({
  addOpencodeMcpServer: vi.fn(),
  clearOpencodeRevert: vi.fn(),
  commitOpencodeRevert: vi.fn(),
  connectOpencodeMcpServer: vi.fn(),
  createOpencodeSession: (...args) => mocks.createSession(...args),
  deleteOpencodeSession: (...args) => mocks.deleteSession(...args),
  deleteSavedOpencodePermission: vi.fn(),
  getOpencodeDiff: vi.fn(async () => []),
  getOpencodeFileStatus: vi.fn(async () => []),
  getOpencodeHealth: vi.fn(async () => ({})),
  getOpencodeInfo: vi.fn(async () => ({})),
  getOpencodePath: vi.fn(async () => ({})),
  getOpencodeSession: vi.fn(async () => ({})),
  getOpencodeVcs: vi.fn(async () => null),
  listOpencodeMcpServers: vi.fn(async () => []),
  listOpencodeMessages: (...args) => mocks.listMessages(...args),
  listSavedOpencodePermissions: vi.fn(async () => []),
  putOpencodeInstructionEntry: (...args) => mocks.writeInstruction(...args),
  removeOpencodeMcpServer: vi.fn(),
  stageOpencodeRevert: vi.fn(),
}));
vi.mock("../../../agents/agentSessions", () => ({
  notifyAgentHistoryChanged: (...args) => mocks.notifyHistory(...args),
  notifyAgentSessionsChanged: (...args) => mocks.notifySessions(...args),
  switchAgentSession: (...args) => mocks.switchSession(...args),
}));
vi.mock("../../../db/agentSessionCache", () => ({
  loadAgentSessionMessages: (...args) => mocks.loadCache(...args),
}));

const agent = {
  id: "agent-1",
  name: "HPC agent",
  sessionId: "session-1",
  serverUrl: "http://127.0.0.1:9000",
};

const cachedMessages = [
  { id: "m1", type: "user", text: "Plan the run" },
  {
    id: "m2",
    type: "assistant",
    content: [{ type: "text", text: "I will inspect the repository." }],
  },
];

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.listMessages.mockRejectedValue(new Error("offline"));
  mocks.loadCache.mockResolvedValue({
    messages: cachedMessages,
    lastMessageId: "m2",
    syncedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  });
  mocks.createSession.mockResolvedValue({ id: "session-new" });
  mocks.writeInstruction.mockResolvedValue({});
  mocks.deleteSession.mockResolvedValue({});
});

describe("AgentToolsModal recovery", () => {
  it("exports the cached transcript when the agent server is unreachable", async () => {
    render(<AgentToolsModal isOpen onClose={() => {}} agent={agent} />);

    await waitFor(() => expect(mocks.listMessages).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Export MD" }));

    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        "Agent server unreachable — exported cached history.",
      ),
    );
    expect(mocks.loadCache).toHaveBeenCalledWith("agent-1", "session-1");
  });

  it("restores the cached transcript into a new session after confirmation", async () => {
    mocks.listMessages.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<AgentToolsModal isOpen onClose={onClose} agent={agent} />);

    fireEvent.click(screen.getByRole("button", { name: "Recovery" }));
    await screen.findByText("Cached messages: 2");

    fireEvent.click(
      screen.getByRole("button", { name: "Restore into new session" }),
    );
    await screen.findByText("Create a new session from the cache?");

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    await waitFor(() =>
      expect(mocks.writeInstruction).toHaveBeenCalledWith(
        agent,
        "session-new",
        "chat-ai-restored-history",
        expect.stringContaining("Plan the run"),
      ),
    );
    expect(mocks.writeInstruction.mock.calls[0][3]).toContain(
      "I will inspect the repository.",
    );
    expect(mocks.switchSession).toHaveBeenCalledWith(agent, "session-new");
    expect(mocks.notifySessions).toHaveBeenCalledWith("agent-1");
    expect(onClose).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith(
      "Restored the cached history into a new session.",
    );
  });

  it("does not create a session when nothing is cached", async () => {
    mocks.listMessages.mockResolvedValue([]);
    mocks.loadCache.mockResolvedValue({
      messages: [],
      lastMessageId: null,
      syncedAt: null,
    });
    render(<AgentToolsModal isOpen onClose={() => {}} agent={agent} />);

    fireEvent.click(screen.getByRole("button", { name: "Recovery" }));
    await screen.findByText("No cached history for this session yet.");

    expect(
      screen.getByRole("button", { name: "Restore into new session" }),
    ).toBeDisabled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
