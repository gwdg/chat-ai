import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentConversation from "../AgentConversation";

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  send: vi.fn(),
}));

vi.mock("../../../apis/opencodeAgents", () => ({
  listOpencodeMessages: (...args) => apiMocks.list(...args),
  sendOpencodePrompt: (...args) => apiMocks.send(...args),
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
  apiMocks.list.mockReset();
  apiMocks.send.mockReset();
  apiMocks.list.mockResolvedValue([]);
  apiMocks.send.mockResolvedValue({
    data: { time: { created: Date.now() } },
  });
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
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(apiMocks.send).toHaveBeenCalledWith(agent, "session-1", "Hello agent"),
    );
  });
});
