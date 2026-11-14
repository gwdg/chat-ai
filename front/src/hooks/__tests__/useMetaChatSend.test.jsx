import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMetaChatSend } from "../useMetaChatSend";
import { chatCompletions } from "../../apis/chatCompletions";
import { createMetaToolRunner } from "../../utils/metaTools";

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({
      user_settings: {
        model: { id: "test-model", name: "Test Model" },
        memories: [{ text: "one memory" }],
        memory_groups: [],
        default_memory_group: "default",
        timeout: 300000,
        memory_mode: 0,
      },
      interface_settings: {},
    }),
  useDispatch: () => vi.fn(),
}));

vi.mock("../useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) => options?.defaultValue ?? key,
  }),
}));

vi.mock("../../apis/chatCompletions", () => ({
  chatCompletions: vi.fn(),
}));

vi.mock("../../utils/metaTools", () => ({
  META_TOOL_DEFINITIONS: [
    { type: "function", function: { name: "list_memories" } },
  ],
  createMetaToolRunner: vi.fn(),
}));

vi.mock("../../config/featureGuides", () => ({
  getFeatureGuideMarker: () => null,
  stripFeatureGuideMarkers: (text) => text,
}));

vi.mock("../../config/useCases", () => ({
  getUseCaseMarker: () => null,
  stripUseCaseMarkers: (text) => text,
}));

vi.mock("../../utils/personaCatalog", () => ({
  getPersonaMarkers: () => [],
  hasPersonaStartLink: () => false,
  stripPersonaMarkers: (text) => text,
}));

const makeState = (messages) => ({
  id: "meta-chat",
  settings: {
    model: { id: "test-model", name: "Test Model" },
    temperature: 0.5,
    top_p: 0.5,
  },
  messages,
});

const makeSetter = (initial) => {
  let state = initial;
  const setLocalState = vi.fn((updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
  });
  return { getState: () => state, setLocalState };
};

const finalMessage = (text) => async function* () {
  yield { choices: [{ delta: { content: text } }] };
};

describe("useMetaChatSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the local tool definitions and streams the final answer", async () => {
    const runner = vi.fn(async () => "tool result");
    vi.mocked(createMetaToolRunner).mockReturnValue(runner);
    vi.mocked(chatCompletions).mockImplementationOnce(finalMessage("Hello from meta"));

    const state = makeState([{ role: "user", content: [{ type: "text", text: "hello" }] }]);
    const setter = makeSetter(state);
    const { result } = renderHook(() => useMetaChatSend([]));

    await act(async () => {
      await result.current({ localState: state, setLocalState: setter.setLocalState });
    });

    const payload = vi.mocked(chatCompletions).mock.calls[0][0];
    expect(payload.settings.function_tools).toEqual([
      { type: "function", function: { name: "list_memories" } },
    ]);
    expect(payload.messages[0].content).toContain("Use the provided tools");
    expect(setter.getState().messages.at(-2).content[0].text).toBe("Hello from meta");
  });

  it("executes a tool call and feeds the result back to the model", async () => {
    const runner = vi.fn(async (name) => `result for ${name}`);
    vi.mocked(createMetaToolRunner).mockReturnValue(runner);
    vi.mocked(chatCompletions)
      .mockImplementationOnce(async function* () {
        yield {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call-1",
                    function: { name: "list_memories", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        };
      })
      .mockImplementationOnce(finalMessage("Done"));

    const state = makeState([{ role: "user", content: [{ type: "text", text: "memories?" }] }]);
    const setter = makeSetter(state);
    const { result } = renderHook(() => useMetaChatSend([]));

    await act(async () => {
      await result.current({ localState: state, setLocalState: setter.setLocalState });
    });

    expect(runner).toHaveBeenCalledWith("list_memories", {});
    expect(chatCompletions).toHaveBeenCalledTimes(2);
    const second = vi.mocked(chatCompletions).mock.calls[1][0];
    expect(second.messages).toContainEqual({
      role: "tool",
      tool_call_id: "call-1",
      content: "result for list_memories",
    });
    expect(setter.getState().messages.at(-2).content[0].text).toBe("Done");
  });

  it.each([
    ["accepted", "I accepted the change."],
    ["rejected", "I rejected the change."],
    [undefined, "I cannot decide."],
  ])("adds the %s decision to the next user message", async (decision, expected) => {
    vi.mocked(chatCompletions).mockImplementationOnce(finalMessage("ok"));
    vi.mocked(createMetaToolRunner).mockReturnValue(vi.fn());

    const state = makeState([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: 'Proposed.\n[[PIN_CHAT:{"id":"chat-1","pinned":true}]]',
          },
        ],
        meta: decision ? { actionDecision: decision } : {},
      },
      { role: "user", content: [{ type: "text", text: "next question" }] },
    ]);
    const setter = makeSetter(state);
    const { result } = renderHook(() => useMetaChatSend([]));

    await act(async () => {
      await result.current({ localState: state, setLocalState: setter.setLocalState });
    });

    const payload = vi.mocked(chatCompletions).mock.calls[0][0];
    const userMessage = payload.messages.findLast((message) => message.role === "user");
    expect(userMessage.content).toBe(`${expected}\n\nnext question`);
  });
});
