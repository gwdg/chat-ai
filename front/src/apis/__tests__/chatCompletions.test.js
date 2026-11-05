import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletions } from "../chatCompletions";
import { createBackendClient } from "../openaiClient";

vi.mock("../openaiClient", () => ({
  createBackendClient: vi.fn(),
}));

const create = vi.fn(async (params) => ({ choices: [{ message: { content: "ok" } }] }));

const conversation = (settings) => ({
  settings: {
    model: { id: "test-model" },
    temperature: 0.5,
    top_p: 0.5,
    ...settings,
  },
  messages: [{ role: "user", content: "hello" }],
});

describe("chatCompletions request shaping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createBackendClient).mockReturnValue({
      chat: { completions: { create } },
    });
  });

  it("forwards function tools when enable_tools is off", async () => {
    const iterator = chatCompletions(
      conversation({
        function_tools: [{ type: "function", function: { name: "list_memories" } }],
        tool_choice: "auto",
      }),
      5000,
      false,
    );
    await iterator.next();

    const params = create.mock.calls[0][0];
    expect(params.tools).toEqual([
      { type: "function", function: { name: "list_memories" } },
    ]);
    expect(params.tool_choice).toBe("auto");
    expect(params.enable_tools).toBeUndefined();
  });

  it("forwards the first enabled remote MCP server", async () => {
    const iterator = chatCompletions(
      conversation({
        tools: { mcp: true },
        mcp_servers: [
          { id: "server-1", enabled: true },
          { id: "server-2", enabled: false },
        ],
      }),
      5000,
      false,
    );
    await iterator.next();

    expect(create.mock.calls[0][0]["mcp-servers"]).toEqual(["server-1"]);
  });
});
