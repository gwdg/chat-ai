import { beforeEach, describe, expect, it } from "vitest";

import {
  clearAgentFormHistory,
  loadAgentFormHistory,
  saveAgentFormHistory,
} from "../agentFormHistory";

const entry = (id, created, patch = {}) => ({
  id,
  form: { id, title: `Form ${id}`, fields: [] },
  time: { created },
  ...patch,
});

beforeEach(() => {
  localStorage.clear();
});

describe("agent form history", () => {
  it("restores forms with their answers", () => {
    saveAgentFormHistory("agent-1", "session-1", [
      entry("form-1", 100, {
        answers: { name: "Alice" },
        time: { created: 100, submitted: 200 },
      }),
    ]);

    expect(loadAgentFormHistory("agent-1", "session-1")).toEqual([
      entry("form-1", 100, {
        answers: { name: "Alice" },
        time: { created: 100, submitted: 200 },
      }),
    ]);
  });

  it("clears the form history of an agent", () => {
    saveAgentFormHistory("agent-1", "session-1", [entry("form-1", 100)]);
    saveAgentFormHistory("agent-2", "session-1", [entry("form-2", 100)]);

    clearAgentFormHistory("agent-1");

    expect(loadAgentFormHistory("agent-1", "session-1")).toEqual([]);
    expect(loadAgentFormHistory("agent-2", "session-1")).toEqual([
      entry("form-2", 100),
    ]);
  });
});
