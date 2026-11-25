import {
  act,
  fireEvent,
  render as testingLibraryRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import AgentConversation from "../AgentConversation";
import { db } from "../../../db";
import { saveAgentSessionMessages, saveAgentSessions } from "../../../db/agentSessionCache";

const render = (ui) =>
  testingLibraryRender(<MemoryRouter>{ui}</MemoryRouter>);

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  listPage: vi.fn(),
  send: vi.fn(),
  interrupt: vi.fn(),
  command: vi.fn(),
  shell: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  updateAgent: vi.fn(),
  permissions: vi.fn(),
  replyPermission: vi.fn(),
  compact: vi.fn(),
  models: vi.fn(),
  defaultModel: vi.fn(),
  sessionInfo: vi.fn(),
  status: vi.fn(),
  setModel: vi.fn(),
  commands: vi.fn(),
  agents: vi.fn(),
  setAgent: vi.fn(),
  forms: vi.fn(),
  replyForm: vi.fn(),
  subscribe: vi.fn(async () => {}),
  getAgent: vi.fn(),
  listSessions: vi.fn(),
  writeInstruction: vi.fn(),
}));

vi.mock("../../../apis/opencodeAgents", () => ({
  listOpencodeMessages: (...args) => apiMocks.list(...args),
  listOpencodeMessagesPage: (...args) => apiMocks.listPage(...args),
  sendOpencodePrompt: (...args) => apiMocks.send(...args),
  interruptOpencodeSession: (...args) => apiMocks.interrupt(...args),
  sendOpencodeCommand: (...args) => apiMocks.command(...args),
  runOpencodeShell: (...args) => apiMocks.shell(...args),
  createOpencodeSession: (...args) => apiMocks.createSession(...args),
  deleteOpencodeSession: (...args) => apiMocks.deleteSession(...args),
  listOpencodePermissions: (...args) => apiMocks.permissions(...args),
  replyOpencodePermission: (...args) => apiMocks.replyPermission(...args),
  compactOpencodeSession: (...args) => apiMocks.compact(...args),
  listOpencodeModels: (...args) => apiMocks.models(...args),
  getOpencodeDefaultModel: (...args) => apiMocks.defaultModel(...args),
  getOpencodeSession: (...args) => apiMocks.sessionInfo(...args),
  getOpencodeSessionStatus: (...args) => apiMocks.status(...args),
  setOpencodeModel: (...args) => apiMocks.setModel(...args),
  listOpencodeCommands: (...args) => apiMocks.commands(...args),
  listOpencodeAgents: (...args) => apiMocks.agents(...args),
  setOpencodeAgent: (...args) => apiMocks.setAgent(...args),
  listOpencodeForms: (...args) => apiMocks.forms(...args),
  replyOpencodeForm: (...args) => apiMocks.replyForm(...args),
  subscribeOpencodeEvents: (...args) => apiMocks.subscribe(...args),
  listOpencodeSessions: (...args) => apiMocks.listSessions(...args),
  putOpencodeInstructionEntry: (...args) => apiMocks.writeInstruction(...args),
}));
vi.mock("../../../agents/agentStore", () => ({
  getAgent: (...args) => apiMocks.getAgent(...args),
  updateAgent: (...args) => apiMocks.updateAgent(...args),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({
      user_settings: {},
      interface_settings: { dark_mode: false },
    }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({
    openModal: vi.fn(),
    confirmAction: (_options, action) => action(),
  }),
}));

const agent = {
  id: "agent-1",
  name: "HPC project 1",
  serverUrl: "http://127.0.0.1:9000",
  username: "opencode",
  password: "secret",
  sessionId: "session-1",
};

beforeEach(async () => {
  localStorage.clear();
  await db.agent_session_messages.clear();
  await db.agent_sessions.clear();
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.list.mockResolvedValue([]);
  apiMocks.listPage.mockImplementation(async (...args) => ({
    messages: await apiMocks.list(...args),
    complete: true,
  }));
  apiMocks.permissions.mockResolvedValue([]);
  apiMocks.send.mockResolvedValue({
    data: { time: { created: Date.now() } },
  });
  apiMocks.interrupt.mockResolvedValue(null);
  apiMocks.command.mockResolvedValue(null);
  apiMocks.shell.mockResolvedValue(null);
  apiMocks.createSession.mockResolvedValue({ id: "session-2" });
  apiMocks.deleteSession.mockResolvedValue(null);
  apiMocks.updateAgent.mockReturnValue(undefined);
  apiMocks.replyPermission.mockResolvedValue(null);
  apiMocks.compact.mockResolvedValue(null);
  apiMocks.models.mockResolvedValue([]);
  apiMocks.defaultModel.mockResolvedValue(null);
  apiMocks.sessionInfo.mockResolvedValue({ model: null });
  apiMocks.status.mockResolvedValue({});
  apiMocks.setModel.mockResolvedValue(null);
  apiMocks.commands.mockResolvedValue([]);
  apiMocks.agents.mockResolvedValue([
    { id: "build", name: "Build", mode: "primary", hidden: false },
  ]);
  apiMocks.setAgent.mockResolvedValue(null);
  apiMocks.forms.mockResolvedValue([]);
  apiMocks.replyForm.mockResolvedValue(null);
  apiMocks.subscribe.mockResolvedValue(undefined);
  apiMocks.listSessions.mockResolvedValue([]);
  apiMocks.writeInstruction.mockResolvedValue({});
});

describe("AgentConversation", () => {
  it("renders the messages from the opencode session", async () => {
    apiMocks.list.mockResolvedValue([
      { id: "m1", type: "user", text: "Hello" },
      {
        id: "m2",
        type: "assistant",
        content: [{ type: "text", text: "Hi there" }],
      },
      { id: "m3", type: "idle", time: { created: Date.now() } },
    ]);

    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("shows the workspace package message above an empty session", async () => {
    render(
      <AgentConversation
        agent={{
          ...agent,
          initialMessage: {
            title: "Start here",
            text: "Read the workspace notes first.",
          },
          initialMessageSessionId: "session-1",
        }}
      />,
    );

    expect(
      await screen.findByText("Message from the package owner"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Read the workspace notes first."),
    ).toBeInTheDocument();
    expect(screen.getByText("Start here")).toBeInTheDocument();
    expect(
      screen.queryByText("No messages yet. Ask the agent something."),
    ).not.toBeInTheDocument();
  });

  it("hides the package message in a later session", async () => {
    render(
      <AgentConversation
        agent={{
          ...agent,
          initialMessage: { title: "Start here", text: "Read the notes." },
          initialMessageSessionId: "session-2",
        }}
      />,
    );

    await screen.findByText("No messages yet. Ask the agent something.");
    expect(
      screen.queryByText("Message from the package owner"),
    ).not.toBeInTheDocument();
  });

  it("renders cached history while the agent is offline", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [
        { id: "cached-1", type: "user", text: "Cached question" },
        {
          id: "cached-2",
          type: "assistant",
          content: [{ type: "text", text: "Cached answer" }],
        },
      ],
      { replace: true },
    );
    apiMocks.list.mockRejectedValue(new Error("connect ECONNREFUSED"));
    apiMocks.listSessions.mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );

    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText("Cached question")).toBeInTheDocument();
    expect(screen.getByText("Cached answer")).toBeInTheDocument();
    expect(
      await screen.findByText(/Showing the history cached at/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/connect ECONNREFUSED/),
    ).not.toBeInTheDocument();
  });

  it("explains an unreachable agent when nothing was cached", async () => {
    apiMocks.list.mockRejectedValue(new Error("connect ECONNREFUSED"));
    apiMocks.listSessions.mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );

    render(<AgentConversation agent={agent} />);

    expect(
      await screen.findByText(/no history has been cached for this session/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/connect ECONNREFUSED/),
    ).not.toBeInTheDocument();
  });

  it("offers to restore cached sessions when the reachable agent lost them", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [
        { id: "cached-1", type: "user", text: "Cached question" },
        {
          id: "cached-2",
          type: "assistant",
          content: [{ type: "text", text: "Cached answer" }],
        },
      ],
      { replace: true },
    );
    await saveAgentSessions("agent-1", [
      { id: "session-1", title: "Design session" },
    ]);
    apiMocks.list.mockRejectedValue(
      new Error("opencode server responded with 404"),
    );
    apiMocks.listSessions.mockResolvedValue([]);

    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText(/Restore (it|them) from the local cache/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Showing the history cached at/),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Restore from cache" }),
    );

    await waitFor(() =>
      expect(apiMocks.writeInstruction).toHaveBeenCalledWith(
        agent,
        "session-2",
        "chat-ai-restored-history",
        expect.stringContaining("Cached question"),
      ),
    );
    expect(apiMocks.createSession).toHaveBeenCalledWith(
      agent,
      "Design session",
    );
    expect(apiMocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      sessionId: "session-2",
    });
    await waitFor(() =>
      expect(screen.queryByTestId("agent-restore-banner")).not.toBeInTheDocument(),
    );
  });

  it("keeps the cached transcript when an empty server lost the session", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [
        { id: "cached-1", type: "user", text: "Cached question" },
        {
          id: "cached-2",
          type: "assistant",
          content: [{ type: "text", text: "Cached answer" }],
        },
      ],
      { replace: true },
    );
    apiMocks.listPage.mockResolvedValue({ messages: [], complete: true });
    apiMocks.list.mockResolvedValue([]);
    apiMocks.listSessions.mockResolvedValue([]);

    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText("Cached question")).toBeInTheDocument();
    expect(
      await screen.findByText(/Restore (it|them) from the local cache/),
    ).toBeInTheDocument();
    expect(screen.getByText("Cached answer")).toBeInTheDocument();
    await waitFor(async () => {
      const rows = await db.agent_session_messages
        .where("[agentId+sessionId]")
        .equals(["agent-1", "session-1"])
        .toArray();
      expect(rows).toHaveLength(2);
    });
  });

  it("keeps a restored transcript when the server timeline is empty", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [{ id: "cached-1", type: "user", text: "Restored question" }],
      { replace: true, restoredFrom: "old-session" },
    );
    apiMocks.listPage.mockResolvedValue({ messages: [], complete: true });
    apiMocks.list.mockResolvedValue([]);
    apiMocks.listSessions.mockResolvedValue([{ id: "session-1" }]);

    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText("Restored question")).toBeInTheDocument();
    expect(
      await screen.findByText(/restored into the session's instructions/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(apiMocks.list).toHaveBeenCalledWith(agent, "session-1"),
    );
    expect(screen.getByText("Restored question")).toBeInTheDocument();
  });

  it("re-reads the history after a revert in the tools modal", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [
        { id: "cached-1", type: "user", text: "Old question" },
        {
          id: "cached-2",
          type: "assistant",
          content: [{ type: "text", text: "Reverted answer" }],
        },
      ],
      { replace: true },
    );
    // The first sync is a normal tail merge; the revert is applied afterwards.
    apiMocks.listPage.mockResolvedValue({
      messages: [
        {
          id: "cached-2",
          type: "assistant",
          content: [{ type: "text", text: "Reverted answer" }],
        },
      ],
      complete: true,
    });
    apiMocks.list.mockResolvedValue([
      { id: "cached-1", type: "user", text: "Old question" },
    ]);

    render(<AgentConversation agent={agent} />);
    expect(await screen.findByText("Reverted answer")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("chatai:agent-history-changed", {
          detail: { agentId: "agent-1", sessionId: "session-1" },
        }),
      );
    });

    await waitFor(() =>
      expect(apiMocks.list).toHaveBeenCalledWith(agent, "session-1"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Reverted answer")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Old question")).toBeInTheDocument();
  });

  it("drops cached messages once the server reports a cleared session", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [
        { id: "cached-1", type: "user", text: "Cached question" },
        {
          id: "cached-2",
          type: "assistant",
          content: [{ type: "text", text: "Cached answer" }],
        },
      ],
      { replace: true },
    );
    apiMocks.listPage.mockResolvedValue({ messages: [], complete: true });
    apiMocks.list.mockResolvedValue([]);
    // The session still exists, so this is a cleared history, not a lost agent.
    apiMocks.listSessions.mockResolvedValue([{ id: "session-1" }]);

    render(<AgentConversation agent={agent} />);

    await waitFor(async () =>
      expect(
        await db.agent_session_messages
          .where("[agentId+sessionId]")
          .equals(["agent-1", "session-1"])
          .count(),
      ).toBe(0),
    );
    expect(screen.queryByText("Cached question")).not.toBeInTheDocument();
    expect(screen.queryByText("Cached answer")).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "No messages yet. Ask the agent something.",
      ),
    ).toBeInTheDocument();
  });

  it("follows a revert that removed the newest cached message", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [
        { id: "cached-1", type: "user", text: "Cached question" },
        {
          id: "cached-2",
          type: "assistant",
          content: [{ type: "text", text: "Reverted answer" }],
        },
      ],
      { replace: true },
    );
    apiMocks.listPage.mockResolvedValue({
      messages: [{ id: "cached-1", type: "user", text: "Cached question" }],
      complete: true,
    });
    apiMocks.list.mockResolvedValue([
      { id: "cached-1", type: "user", text: "Cached question" },
    ]);

    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText("Cached question")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Reverted answer")).not.toBeInTheDocument(),
    );
    await waitFor(async () =>
      expect(
        await db.agent_session_messages
          .where("[agentId+sessionId]")
          .equals(["agent-1", "session-1"])
          .count(),
      ).toBe(1),
    );
  });

  it("asks the server only for messages newer than the cached tail", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [
        { id: "cached-1", type: "user", text: "Cached question" },
        { id: "cached-2", type: "assistant", content: [] },
      ],
      { replace: true },
    );
    apiMocks.listPage.mockResolvedValue({
      messages: [
        { id: "cached-2", type: "assistant", content: [] },
        { id: "cached-3", type: "assistant", content: [] },
      ],
      complete: true,
    });

    render(<AgentConversation agent={agent} />);

    await waitFor(() =>
      expect(apiMocks.listPage).toHaveBeenCalledWith(
        agent,
        "session-1",
        { newestId: "cached-2" },
      ),
    );
    expect(await screen.findByText("Cached question")).toBeInTheDocument();
  });

  it("sends the prompt to the opencode session", async () => {
    render(<AgentConversation agent={agent} />);

    const input = screen.getByPlaceholderText(
      "No messages yet. Ask the agent something.",
    );
    fireEvent.change(input, { target: { value: "Hello agent" } });
    fireEvent.click(document.querySelector('[data-guide="send"]'));

    await waitFor(() =>
      expect(apiMocks.send).toHaveBeenCalledWith(
        agent,
        "session-1",
        "Hello agent",
        [],
      ),
    );
  });
});

describe("AgentConversation control commands", () => {
  it("sends slash commands to opencode", async () => {
    render(<AgentConversation agent={agent} />);
    const input = screen.getByPlaceholderText(
      "No messages yet. Ask the agent something.",
    );

    fireEvent.change(input, { target: { value: "/review please" } });
    fireEvent.click(document.querySelector('[data-guide="send"]'));
    await waitFor(() =>
      expect(apiMocks.command).toHaveBeenCalledWith(
        agent,
        "session-1",
        "review",
        "please",
      ),
    );
  });

  it("sends shell input to opencode", async () => {
    render(<AgentConversation agent={agent} />);
    const input = screen.getByPlaceholderText(
      "No messages yet. Ask the agent something.",
    );

    fireEvent.change(input, { target: { value: "!ls -la" } });
    fireEvent.click(document.querySelector('[data-guide="send"]'));
    await waitFor(() =>
      expect(apiMocks.shell).toHaveBeenCalledWith(agent, "session-1", "ls -la"),
    );
  });

  it("clears the history by replacing the OpenCode session", async () => {
    render(<AgentConversation agent={agent} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Clear agent history" }),
    );

    await waitFor(() =>
      expect(apiMocks.createSession).toHaveBeenCalledWith(
        agent,
        "HPC project 1 agent",
      ),
    );
    expect(apiMocks.updateAgent).toHaveBeenCalledWith("agent-1", {
      sessionId: "session-2",
    });
    expect(apiMocks.deleteSession).toHaveBeenCalledWith(agent, "session-1");
  });

  it("shows the submitted form answers in the conversation", async () => {
    apiMocks.forms.mockResolvedValue([
      {
        id: "form-1",
        title: "Choose a name",
        fields: [
          {
            key: "name",
            title: "Name",
            type: "text",
            default: "Alice",
          },
        ],
      },
    ]);
    render(<AgentConversation agent={agent} />);

    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(apiMocks.replyForm).toHaveBeenCalledWith(
        agent,
        "session-1",
        "form-1",
        { name: "Alice" },
      ),
    );
    expect(await screen.findByText("Choose a name")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("restores submitted forms after remounting the agent chat", async () => {
    apiMocks.forms.mockResolvedValue([
      {
        id: "form-2",
        title: "Remember this",
        fields: [
          {
            key: "name",
            title: "Name",
            type: "text",
            default: "Bob",
          },
        ],
      },
    ]);
    const first = render(<AgentConversation agent={agent} />);

    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await waitFor(() => expect(apiMocks.replyForm).toHaveBeenCalled());
    expect(await screen.findByText("Remember this")).toBeInTheDocument();

    first.unmount();
    apiMocks.forms.mockResolvedValue([]);
    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText("Remember this")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("answers pending permission requests", async () => {
    apiMocks.permissions.mockResolvedValue([
      { id: "perm-1", action: "bash", resources: ["ls"] },
    ]);
    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText(/bash/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));

    await waitFor(() =>
      expect(apiMocks.replyPermission).toHaveBeenCalledWith(
        agent,
        "session-1",
        "perm-1",
        "once",
      ),
    );
  });

  it("drops permission results that resolve after switching sessions", async () => {
    let resolveFirst;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    apiMocks.permissions.mockImplementation((_currentAgent, sessionId) =>
      sessionId === "session-1" ? first : Promise.resolve([]),
    );
    const nextAgent = { ...agent, sessionId: "session-2" };
    const { rerender } = render(<AgentConversation agent={agent} />);

    await waitFor(() =>
      expect(apiMocks.permissions).toHaveBeenCalledWith(agent, "session-1"),
    );
    rerender(
      <MemoryRouter>
        <AgentConversation agent={nextAgent} />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(apiMocks.permissions).toHaveBeenCalledWith(
        nextAgent,
        "session-2",
      ),
    );

    await act(async () => {
      resolveFirst([{ id: "perm-a", action: "bash", resources: ["ls"] }]);
    });

    expect(screen.queryByText(/bash/)).not.toBeInTheDocument();
  });

  it("interrupts a running turn", async () => {
    apiMocks.send.mockImplementation(() => new Promise(() => {}));
    render(<AgentConversation agent={agent} />);

    const input = screen.getByPlaceholderText(
      "No messages yet. Ask the agent something.",
    );
    fireEvent.change(input, { target: { value: "Long task" } });
    fireEvent.click(document.querySelector('[data-guide="send"]'));

    fireEvent.click(await screen.findByRole("button", { name: "Abort" }));
    await waitFor(() =>
      expect(apiMocks.interrupt).toHaveBeenCalledWith(agent, "session-1"),
    );
    expect(await screen.findByText("Aborted by user")).toBeInTheDocument();
  });
});

describe("AgentConversation model selector", () => {
  it("shows only models available through ChatAI", async () => {
    apiMocks.models.mockResolvedValue([
      {
        id: "model-a",
        modelID: "model-a",
        providerID: "gwdg",
        name: "Model A",
        capabilities: { input: ["text"], output: ["text"] },
        time: { released: 0 },
        enabled: true,
      },
      {
        id: "model-b",
        modelID: "model-b",
        providerID: "opencode",
        name: "Model B",
        capabilities: { input: ["text"], output: ["text"] },
        time: { released: 0 },
        enabled: true,
      },
    ]);
    apiMocks.sessionInfo.mockResolvedValue({
      model: { id: "model-a", providerID: "gwdg" },
    });

    render(
      <AgentConversation
        agent={agent}
        modelsData={[{ id: "model-a", name: "Model A" }]}
      />,
    );

    expect(await screen.findByText("Model A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change model" }));
    expect(screen.queryByText("Model B")).not.toBeInTheDocument();
  });
});

describe("AgentConversation command dropdown", () => {
  it("runs a command selected from the dropdown", async () => {
    apiMocks.commands.mockResolvedValue([
      { name: "review", description: "review changes" },
    ]);
    render(<AgentConversation agent={agent} />);

    const select = await screen.findByLabelText("Commands");
    await waitFor(() =>
      expect(select.querySelector('option[value="review"]')).toBeTruthy(),
    );
    fireEvent.change(select, { target: { value: "review" } });

    await waitFor(() =>
      expect(apiMocks.command).toHaveBeenCalledWith(
        agent,
        "session-1",
        "review",
        "",
      ),
    );
  });
});

describe("AgentConversation prompt history", () => {
  const composer = () =>
    screen.getByPlaceholderText("No messages yet. Ask the agent something.");

  it("recalls a sent prompt with ArrowUp and returns to the draft with ArrowDown", async () => {
    render(<AgentConversation agent={agent} />);
    const input = composer();

    fireEvent.change(input, { target: { value: "first prompt" } });
    fireEvent.click(document.querySelector('[data-guide="send"]'));
    await waitFor(() =>
      expect(apiMocks.send).toHaveBeenCalledWith(
        agent,
        "session-1",
        "first prompt",
        [],
      ),
    );
    await waitFor(() => expect(input).toHaveValue(""));

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("first prompt");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("");
  });

  it("restores an unsent draft after walking through the history", async () => {
    render(<AgentConversation agent={agent} />);
    const input = composer();

    fireEvent.change(input, { target: { value: "older prompt" } });
    fireEvent.click(document.querySelector('[data-guide="send"]'));
    await waitFor(() => expect(apiMocks.send).toHaveBeenCalled());
    await waitFor(() => expect(input).toHaveValue(""));

    fireEvent.change(input, { target: { value: "half written" } });
    input.setSelectionRange(4, 4);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("older prompt");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("half written");
  });

  it("keeps the arrow keys inside a multiline prompt", async () => {
    render(<AgentConversation agent={agent} />);
    const input = composer();

    fireEvent.change(input, { target: { value: "older prompt" } });
    fireEvent.click(document.querySelector('[data-guide="send"]'));
    await waitFor(() => expect(apiMocks.send).toHaveBeenCalled());
    await waitFor(() => expect(input).toHaveValue(""));

    fireEvent.change(input, { target: { value: "line one\nline two" } });
    const end = input.value.length;
    input.setSelectionRange(end, end);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("line one\nline two");
  });
});
