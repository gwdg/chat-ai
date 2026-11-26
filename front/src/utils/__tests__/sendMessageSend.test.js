import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `sendMessage` builds the request before it hands it to chatCompletions; the
// mocked generator keeps the send path offline.
const { chatCompletions } = vi.hoisted(() => ({ chatCompletions: vi.fn() }));
vi.mock("../../apis/chatCompletions", () => ({ chatCompletions }));

// A brand tool reads its data from the course catalog; the quiz tool must not
// hit the network in a unit test.
const { ensureCourse } = vi.hoisted(() => ({ ensureCourse: vi.fn() }));
vi.mock("../courseCatalog", () => ({ ensureCourse }));

import sendMessage from "../sendMessage";
import { getBrandProfile, setCurrentBrand } from "../../config/brands";
import { clearBrandFeatureCache } from "../../config/brandFeatures";

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

  it("attaches a brand feature's function tools on the plain chat path", async () => {
    // The GAIA brand switches the agent module off, which is exactly the case the
    // app-side tool loop covers: the request must carry both course-material tools.
    setCurrentBrand(getBrandProfile("gaia"));
    clearBrandFeatureCache();
    try {
      await run({
        ...localState({ model: { id: "some-tool-model" } }),
        persona: { courseId: "c-programmierung" },
      });

      const conversation = chatCompletions.mock.calls[0][0];
      expect(conversation.settings.tool_choice).toBe("auto");
      expect(
        conversation.settings.function_tools.map(
          (definition) => definition.function.name,
        ),
      ).toEqual(["show_course_quiz", "show_course_page"]);
    } finally {
      setCurrentBrand(null);
      clearBrandFeatureCache();
    }
  });

  it("adds no brand tool when the persona is not a course", async () => {
    setCurrentBrand(getBrandProfile("gaia"));
    clearBrandFeatureCache();
    try {
      await run({ ...localState(), persona: { title: "Not a course" } });

      const conversation = chatCompletions.mock.calls[0][0];
      expect(conversation.settings.function_tools).toBeUndefined();
      expect(conversation.settings.tool_choice).toBeUndefined();
    } finally {
      setCurrentBrand(null);
      clearBrandFeatureCache();
    }
  });
});

describe("brand tool rounds", () => {
  const fence = ['```gaia-quiz', '{"course":"c-programmierung","id":"q-1"}', "```"].join("\n");

  const course = {
    id: "c-programmierung",
    title: "C-Programmierung",
    questions: [
      {
        id: "q-1",
        type: "single_choice",
        question: "Welche Antwort stimmt?",
        answers: ["falsch", "richtig"],
        correct: [1],
        skills: [],
        tags: [],
        status: "draft",
        explanation: "",
      },
    ],
    skillsDoc: { skills: [] },
  };

  // Drives the whole turn, so it needs a real state updater: the loop only runs
  // when setLocalState exists.
  const runWithState = async (state) => {
    let current = state;
    await sendMessage({
      localState: state,
      setLocalState: (updater) => {
        current = typeof updater === "function" ? updater(current) : updater;
      },
      memories: [],
      openModal: vi.fn(),
      notifyError: vi.fn(),
      notifySuccess: vi.fn(),
      dispatch: vi.fn(),
      timeout: 30000,
    });
    return current;
  };

  beforeEach(() => {
    ensureCourse.mockReset();
    ensureCourse.mockResolvedValue(course);
  });

  it("stops after the round without a tool call instead of answering twice", async () => {
    setCurrentBrand(getBrandProfile("gaia"));
    clearBrandFeatureCache();
    try {
      let round = 0;
      chatCompletions.mockImplementation(async function* rounds() {
        round += 1;
        if (round === 1) {
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call-1",
                      function: { name: "show_course_quiz", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
          };
          return;
        }
        yield { choices: [{ delta: { content: fence } }] };
        // A usage-only chunk has no choices; it must not abort the turn.
        yield { choices: [], usage: { total_tokens: 12 } };
      });

      const state = await runWithState({
        ...localState({ model: { id: "some-tool-model" } }),
        persona: { courseId: "c-programmierung" },
      });

      // Regression: a second answer round used to be requested as well, which
      // glued a repeated fence into one broken code block.
      expect(chatCompletions).toHaveBeenCalledTimes(2);
      const assistant = state.messages.find((message) => message.role === "assistant");
      expect(assistant.content[0].text).toBe(fence);
    } finally {
      setCurrentBrand(null);
      clearBrandFeatureCache();
    }
  });
});
