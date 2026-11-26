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

  it("never sends an MCP field: servers are connected in the browser", async () => {
    const iterator = chatCompletions(
      conversation({
        tools: { mcp: true },
        mcp_servers: [
          { url: "http://localhost:9000/mcp", enabled: true },
          { id: "legacy-gateway", enabled: true },
        ],
      }),
      5000,
      false,
    );
    await iterator.next();

    expect(create.mock.calls[0][0]["mcp-servers"]).toBeUndefined();
  });

  it("passes a usage-only chunk through and keeps its token counts", async () => {
    // `stream_options.include_usage` closes the stream with a chunk that has no
    // choices. Dropping it lost the usage of every turn and logged a warning.
    create.mockImplementation(async function* chunks() {
      yield { choices: [{ delta: { content: "Hi" } }] };
      yield { choices: [], usage: { total_tokens: 7 } };
      yield { choices: [{ delta: {}, finish_reason: "stop" }] };
      yield { choices: [], usage: { total_tokens: 11 } };
    });

    const iterator = chatCompletions(conversation({}), 5000, true);
    const chunks = [];
    let step = await iterator.next();
    while (!step.done) {
      chunks.push(step.value);
      step = await iterator.next();
    }

    expect(chunks).toHaveLength(4);
    expect(chunks[1]).toEqual({ choices: [], usage: { total_tokens: 7 } });
    expect(step.value).toEqual({
      answer: "Hi",
      usage: { total_tokens: 11 },
    });
  });
});
