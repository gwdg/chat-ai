import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentConversation from "../AgentConversation";

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
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
  setModel: vi.fn(),
  commands: vi.fn(),
  agents: vi.fn(),
  setAgent: vi.fn(),
  forms: vi.fn(),
  replyForm: vi.fn(),
  subscribe: vi.fn(async () => {}),
}));

vi.mock("../../../apis/opencodeAgents", () => ({
  listOpencodeMessages: (...args) => apiMocks.list(...args),
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
  setOpencodeModel: (...args) => apiMocks.setModel(...args),
  listOpencodeCommands: (...args) => apiMocks.commands(...args),
  listOpencodeAgents: (...args) => apiMocks.agents(...args),
  setOpencodeAgent: (...args) => apiMocks.setAgent(...args),
  listOpencodeForms: (...args) => apiMocks.forms(...args),
  replyOpencodeForm: (...args) => apiMocks.replyForm(...args),
  subscribeOpencodeEvents: (...args) => apiMocks.subscribe(...args),
}));
vi.mock("../../../agents/agentStore", () => ({
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

beforeEach(() => {
  localStorage.clear();
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.list.mockResolvedValue([]);
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
  apiMocks.setModel.mockResolvedValue(null);
  apiMocks.commands.mockResolvedValue([]);
  apiMocks.agents.mockResolvedValue([
    { id: "build", name: "Build", mode: "primary", hidden: false },
  ]);
  apiMocks.setAgent.mockResolvedValue(null);
  apiMocks.forms.mockResolvedValue([]);
  apiMocks.replyForm.mockResolvedValue(null);
  apiMocks.subscribe.mockResolvedValue(undefined);
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
    expect(await screen.findByText("Form results")).toBeInTheDocument();
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
    expect(await screen.findByText("Form results")).toBeInTheDocument();

    first.unmount();
    apiMocks.forms.mockResolvedValue([]);
    render(<AgentConversation agent={agent} />);

    expect(await screen.findByText("Form results")).toBeInTheDocument();
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
