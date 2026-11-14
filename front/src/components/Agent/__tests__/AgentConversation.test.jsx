import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentConversation from "../AgentConversation";

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  send: vi.fn(),
  interrupt: vi.fn(),
  command: vi.fn(),
  shell: vi.fn(),
  permissions: vi.fn(),
  replyPermission: vi.fn(),
  compact: vi.fn(),
  models: vi.fn(),
  defaultModel: vi.fn(),
  sessionInfo: vi.fn(),
  setModel: vi.fn(),
  commands: vi.fn(),
}));

vi.mock("../../../apis/opencodeAgents", () => ({
  listOpencodeMessages: (...args) => apiMocks.list(...args),
  sendOpencodePrompt: (...args) => apiMocks.send(...args),
  interruptOpencodeSession: (...args) => apiMocks.interrupt(...args),
  sendOpencodeCommand: (...args) => apiMocks.command(...args),
  runOpencodeShell: (...args) => apiMocks.shell(...args),
  listOpencodePermissions: (...args) => apiMocks.permissions(...args),
  replyOpencodePermission: (...args) => apiMocks.replyPermission(...args),
  compactOpencodeSession: (...args) => apiMocks.compact(...args),
  listOpencodeModels: (...args) => apiMocks.models(...args),
  getOpencodeDefaultModel: (...args) => apiMocks.defaultModel(...args),
  getOpencodeSession: (...args) => apiMocks.sessionInfo(...args),
  setOpencodeModel: (...args) => apiMocks.setModel(...args),
  listOpencodeCommands: (...args) => apiMocks.commands(...args),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({
      user_settings: {},
      interface_settings: { dark_mode: false },
    }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
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
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.list.mockResolvedValue([]);
  apiMocks.permissions.mockResolvedValue([]);
  apiMocks.send.mockResolvedValue({
    data: { time: { created: Date.now() } },
  });
  apiMocks.interrupt.mockResolvedValue(null);
  apiMocks.command.mockResolvedValue(null);
  apiMocks.shell.mockResolvedValue(null);
  apiMocks.replyPermission.mockResolvedValue(null);
  apiMocks.compact.mockResolvedValue(null);
  apiMocks.models.mockResolvedValue([]);
  apiMocks.defaultModel.mockResolvedValue(null);
  apiMocks.sessionInfo.mockResolvedValue({ model: null });
  apiMocks.setModel.mockResolvedValue(null);
  apiMocks.commands.mockResolvedValue([]);
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
      expect(apiMocks.send).toHaveBeenCalledWith(agent, "session-1", "Hello agent"),
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
