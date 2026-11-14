import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAgentShellHistory,
  loadAgentShellHistory,
  mergeAgentMessages,
  saveAgentShellHistory,
} from "../agentShellHistory";

const shell = (id, created, patch = {}) => ({
  id: `shell:${id}`,
  type: "shell",
  shellID: id,
  command: `command ${id}`,
  status: "exited",
  exit: 0,
  time: { created },
  ...patch,
});

beforeEach(() => {
  localStorage.clear();
});

describe("mergeAgentMessages", () => {
  it("keeps shell commands at their position in the timeline", () => {
    const messages = [
      { id: "user-1", type: "user", text: "First", time: { created: 100 } },
      {
        id: "assistant-1",
        type: "assistant",
        content: [],
        time: { created: 300 },
      },
    ];
    const shells = new Map([["s1", shell("s1", 200)]]);

    expect(mergeAgentMessages(messages, shells).map((message) => message.id)).toEqual([
      "user-1",
      "shell:s1",
      "assistant-1",
    ]);
  });
});

describe("agent shell history", () => {
  it("persists shell messages for a session", () => {
    saveAgentShellHistory("agent-1", "session-1", [shell("s1", 100)]);

    expect(loadAgentShellHistory("agent-1", "session-1")).toEqual([
      shell("s1", 100),
    ]);
  });

  it("clears the history of an agent", () => {
    saveAgentShellHistory("agent-1", "session-1", [shell("s1", 100)]);
    saveAgentShellHistory("agent-2", "session-1", [shell("s2", 100)]);

    clearAgentShellHistory("agent-1");

    expect(loadAgentShellHistory("agent-1", "session-1")).toEqual([]);
    expect(loadAgentShellHistory("agent-2", "session-1")).toEqual([
      shell("s2", 100),
    ]);
  });
});
