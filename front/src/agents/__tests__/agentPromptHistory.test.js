import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_ENTRIES,
  addPromptEntry,
  clearAgentPromptHistories,
  clearAgentPromptHistory,
  loadAgentPromptHistory,
  nextHistoryIndex,
  recordAgentPrompt,
} from "../agentPromptHistory";

beforeEach(() => {
  localStorage.clear();
});

describe("prompt entry list", () => {
  it("keeps the newest prompt first", () => {
    let entries = addPromptEntry([], "first");
    entries = addPromptEntry(entries, "second");

    expect(entries).toEqual(["second", "first"]);
  });

  it("does not store the same prompt twice in a row", () => {
    const entries = addPromptEntry(["first"], "first");

    // Otherwise the second ArrowUp would return the same text and look broken.
    expect(entries).toEqual(["first"]);
  });

  it("ignores empty and whitespace-only prompts", () => {
    expect(addPromptEntry(["first"], "   ")).toEqual(["first"]);
    expect(addPromptEntry([], "")).toEqual([]);
  });

  it("keeps only the newest entries", () => {
    let entries = [];
    for (let index = 0; index < MAX_ENTRIES + 10; index += 1) {
      entries = addPromptEntry(entries, `prompt ${index}`);
    }

    expect(entries).toHaveLength(MAX_ENTRIES);
    expect(entries[0]).toBe(`prompt ${MAX_ENTRIES + 9}`);
  });
});

describe("history cursor", () => {
  it("stays on the draft while there is no history", () => {
    expect(nextHistoryIndex(0, -1, -1)).toBe(-1);
    expect(nextHistoryIndex(0, -1, 1)).toBe(-1);
  });

  it("walks back from the draft to the oldest prompt and stops", () => {
    expect(nextHistoryIndex(3, -1, -1)).toBe(0);
    expect(nextHistoryIndex(3, 0, -1)).toBe(1);
    expect(nextHistoryIndex(3, 2, -1)).toBe(2);
  });

  it("walks forward again and ends on the draft", () => {
    expect(nextHistoryIndex(3, 2, 1)).toBe(1);
    expect(nextHistoryIndex(3, 0, 1)).toBe(-1);
    expect(nextHistoryIndex(3, -1, 1)).toBe(-1);
  });
});

describe("stored prompt history", () => {
  it("is per agent and per session", () => {
    recordAgentPrompt("agent-1", "session-1", "hello");

    expect(loadAgentPromptHistory("agent-1", "session-1")).toEqual(["hello"]);
    // A new session is a new shell: nothing to recall yet.
    expect(loadAgentPromptHistory("agent-1", "session-2")).toEqual([]);
    expect(loadAgentPromptHistory("agent-2", "session-1")).toEqual([]);
  });

  it("survives a reload and clears one session", () => {
    recordAgentPrompt("agent-1", "session-1", "one");
    recordAgentPrompt("agent-1", "session-2", "two");

    clearAgentPromptHistory("agent-1", "session-1");

    expect(loadAgentPromptHistory("agent-1", "session-1")).toEqual([]);
    expect(loadAgentPromptHistory("agent-1", "session-2")).toEqual(["two"]);
  });

  it("clears every session of an agent", () => {
    recordAgentPrompt("agent-1", "session-1", "one");
    recordAgentPrompt("agent-1", "session-2", "two");
    recordAgentPrompt("agent-2", "session-1", "other");

    clearAgentPromptHistories("agent-1");

    expect(loadAgentPromptHistory("agent-1", "session-1")).toEqual([]);
    expect(loadAgentPromptHistory("agent-1", "session-2")).toEqual([]);
    expect(loadAgentPromptHistory("agent-2", "session-1")).toEqual(["other"]);
  });

  it("ignores stored text that is not a list of prompts", () => {
    localStorage.setItem(
      "chatai.agent-prompt-history:agent-1:session-1",
      JSON.stringify(["ok", 3, null, ""]),
    );

    expect(loadAgentPromptHistory("agent-1", "session-1")).toEqual(["ok"]);
  });
});
