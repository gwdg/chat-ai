import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `sendMessage` builds the request before it hands it to chatCompletions; the
// mocked generator keeps the send path offline.
const { chatCompletions } = vi.hoisted(() => ({ chatCompletions: vi.fn() }));
vi.mock("../../apis/chatCompletions", () => ({ chatCompletions }));

import sendMessage from "../sendMessage";

const originalToolsModule = import.meta.env.VITE_MODULE_TOOLS;

const localState = ({ enableTools = false, model = { id: "some-tool-model" } } = {}) => ({
  id: "conversation-1",
  settings: {
    model,
    enable_tools: enableTools,
    tools: { web_search: true, arcana: false },
  },
  messages: [
    { role: "system", content: [{ type: "text", text: "system prompt" }] },
    { role: "user", content: [{ type: "text", text: "hello" }] },
  ],
});

const run = (state) =>
  sendMessage({
    localState: state,
    // Without setLocalState the function stops after the API call, so the test
    // never reaches title generation or memory updates.
    setLocalState: undefined,
    memories: [],
    openModal: vi.fn(),
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
    dispatch: vi.fn(),
    timeout: 30000,
  });

beforeEach(() => {
  chatCompletions.mockReset();
  chatCompletions.mockImplementation(async function* empty() {});
});

afterEach(() => {
  if (originalToolsModule === undefined) delete import.meta.env.VITE_MODULE_TOOLS;
  else import.meta.env.VITE_MODULE_TOOLS = originalToolsModule;
});

describe("sendMessage module gates", () => {
  // Regression: the local `enable_tools` flag used to be named `isToolsEnabled`,
  // shadowing the imported module gate and throwing "Cannot access
  // 'isToolsEnabled' before initialization" on every send.
  it("reads the tools module without hitting a shadowed binding", async () => {
    const notifyError = vi.fn();
    await sendMessage({
      localState: localState(),
      setLocalState: undefined,
      memories: [],
      openModal: vi.fn(),
      notifyError,
      notifySuccess: vi.fn(),
      dispatch: vi.fn(),
      timeout: 30000,
    });

    expect(notifyError).not.toHaveBeenCalled();
    expect(chatCompletions).toHaveBeenCalledTimes(1);
  });

  it("drops tools for a model that cannot call them", async () => {
    import.meta.env.VITE_MODULE_TOOLS = "true";

    await run(localState({ enableTools: true, model: { id: "qwen3-omni-30b-a3b-instruct" } }));

    const conversation = chatCompletions.mock.calls[0][0];
    expect(conversation.settings.tools).toBeUndefined();
    expect(conversation.settings.enable_tools).toBeUndefined();
  });

  it("forwards the enabled tools when the module and the model allow it", async () => {
    import.meta.env.VITE_MODULE_TOOLS = "true";

    await run(localState({ enableTools: true }));

    const conversation = chatCompletions.mock.calls[0][0];
    // The turn always adds audio transcription to an enabled tool list.
    expect(conversation.settings.tools).toEqual([
      { type: "web_search" },
      { type: "audio_transcription" },
    ]);
  });
});
