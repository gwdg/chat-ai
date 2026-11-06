import { describe, expect, it } from "vitest";
import { reasoningParams } from "../chatCompletions";

describe("reasoningParams", () => {
  it("maps configured reasoning levels for Claude models", () => {
    expect(reasoningParams("claude-fable-5-1", {})).toEqual({
      reasoning_effort: "high",
      chat_template_kwargs: { enable_thinking: true, reasoning_effort: "high" },
    });
  });

  it("uses chat-template flags for internal models", () => {
    expect(reasoningParams("deepseek-v4.1-flash-1017", { reasoning_effort: 0 })).toEqual({
      chat_template_kwargs: { enable_thinking: false },
    });
    expect(reasoningParams("deepseek-v4.1-flash-1017", { reasoning_effort: 2 })).toEqual({
      chat_template_kwargs: { enable_thinking: true, reasoning_effort: "high" },
    });
  });

  it("returns no parameters for unknown models", () => {
    expect(reasoningParams("not-a-configured-model", {})).toEqual({});
  });
});
