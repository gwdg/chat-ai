import { describe, expect, it } from "vitest";
import userSettingsReducer, {
  addMemory,
  deleteAllMemories,
  deleteMemory,
  editMemory,
  importUserSettings,
  setMemoryMode,
  setSendWithEnter,
  selectMemoryMode,
  selectConversationSummaries,
  selectCollapseReasoningWhileStreaming,
  setCollapseReasoningWhileStreaming,
} from "../userSettingsReducer";
import interfaceSettingsReducer, {
  agreeWebSearch,
  markTutorialCompleted,
  markUseCaseCompleted,
  setConversationGrouping,
  setWarning,
  suppressTutorial,
  toggleTheme,
  selectAgreeWebSearch,
  selectConversationGrouping,
} from "../interfaceSettingsSlice";

const init = (reducer) => reducer(undefined, { type: "@@INIT" });

describe("user settings reducer", () => {
  it("adds, edits, and deletes memories", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(state, addMemory({ text: "  one  " }));
    state = userSettingsReducer(state, addMemory({ text: "two" }));
    expect(state.memories.map((memory) => memory.text)).toEqual(["one", "two"]);

    state = userSettingsReducer(state, editMemory({ index: 0, text: "updated" }));
    expect(state.memories[0].text).toBe("updated");

    state = userSettingsReducer(state, deleteMemory({ index: 1 }));
    expect(state.memories).toHaveLength(1);
    state = userSettingsReducer(state, deleteAllMemories());
    expect(state.memories).toEqual([]);
  });

  it("validates memory mode and send shortcut", () => {
    let state = init(userSettingsReducer);
    state = userSettingsReducer(state, setMemoryMode(2));
    expect(state.memory_mode).toBe(2);
    state = userSettingsReducer(state, setMemoryMode(9));
    expect(state.memory_mode).toBe(2);
    state = userSettingsReducer(state, setSendWithEnter(false));
    expect(state.send_with_enter).toBe(false);
  });

  it("imports sanitized settings", () => {
    const state = userSettingsReducer(
      init(userSettingsReducer),
      importUserSettings({
        timeout: 1,
        memory_mode: 1,
        html_render_mode: "render",
        unknown: "ignored",
      }),
    );
    expect(state.timeout).toBe(5000);
    expect(state.memory_mode).toBe(1);
    expect(state.html_render_mode).toBe("render");
    expect(state.unknown).toBeUndefined();
  });

  it("validates the reasoning streaming preference", () => {
    let state = init(userSettingsReducer);
    expect(
      selectCollapseReasoningWhileStreaming({ user_settings: state }),
    ).toBe(true);

    state = userSettingsReducer(
      state,
      setCollapseReasoningWhileStreaming(false),
    );
    expect(state.collapse_reasoning_while_streaming).toBe(false);

    state = userSettingsReducer(
      state,
      importUserSettings({ collapse_reasoning_while_streaming: true }),
    );
    expect(state.collapse_reasoning_while_streaming).toBe(true);
  });

  it("falls back to safe selector values", () => {
    expect(selectMemoryMode({ user_settings: { memory_mode: 99 } })).toBe(0);
    expect(selectConversationSummaries({ user_settings: {} })).toBe(true);
  });
});

describe("interface settings reducer", () => {
  it("toggles theme and records accepted disclaimers", () => {
    let state = init(interfaceSettingsReducer);
    expect(state.dark_mode).toBe(false);
    state = interfaceSettingsReducer(state, toggleTheme());
    expect(state.dark_mode).toBe(true);
    state = interfaceSettingsReducer(state, agreeWebSearch());
    expect(selectAgreeWebSearch({ interface_settings: state })).toBe(true);
  });

  it("validates conversation grouping", () => {
    let state = init(interfaceSettingsReducer);
    state = interfaceSettingsReducer(state, setConversationGrouping("date"));
    expect(selectConversationGrouping({ interface_settings: state })).toBe("date");
    state = interfaceSettingsReducer(state, setConversationGrouping("invalid"));
    expect(selectConversationGrouping({ interface_settings: state })).toBe("date");
  });

  it("tracks completed and suppressed tutorials without duplicates", () => {
    let state = init(interfaceSettingsReducer);
    state = interfaceSettingsReducer(state, markTutorialCompleted("upload_file"));
    state = interfaceSettingsReducer(state, markTutorialCompleted("upload_file"));
    state = interfaceSettingsReducer(state, markUseCaseCompleted("uc-1"));
    state = interfaceSettingsReducer(state, suppressTutorial("upload_file"));
    expect(state.completed_tutorials).toEqual(["upload_file"]);
    expect(state.completed_use_cases).toEqual(["uc-1"]);
    expect(state.suppressed_tutorials).toEqual(["upload_file"]);
  });

  it("sets warning flags", () => {
    const state = interfaceSettingsReducer(
      init(interfaceSettingsReducer),
      setWarning({ key: "warn_fork", value: false }),
    );
    expect(state.warn_fork).toBe(false);
  });
});
