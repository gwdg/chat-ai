import { describe, expect, it } from "vitest";
import {
  conversationSummarySignature,
  extractMessageText,
  messagesForSummary,
} from "../conversationSummary";

describe("conversation summaries", () => {
  it("extracts text and handles invalid content", () => {
    expect(extractMessageText({ content: "plain" })).toBe("plain");
    expect(extractMessageText({ content: [{ type: "file", fileId: "f" }] })).toBe("");
    expect(extractMessageText({})).toBe("");
  });

  it("ignores empty and system messages", () => {
    const messages = messagesForSummary([
      { role: "system", content: [{ type: "text", text: "system" }] },
      { role: "user", content: [{ type: "text", text: "  hello  " }] },
      { role: "assistant", content: [{ type: "text", text: "" }] },
      { role: "assistant", content: [{ type: "text", text: "reply" }] },
    ]);
    expect(messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "reply" },
    ]);
  });

  it("keeps the most recent messages when the cap is reached", () => {
    const long = "x".repeat(24000);
    const messages = messagesForSummary([
      { role: "user", content: [{ type: "text", text: long }] },
      { role: "assistant", content: [{ type: "text", text: "latest" }] },
    ]);
    expect(messages.at(-1).content).toBe("latest");
  });

  it("returns an empty signature without content and changes with text", () => {
    expect(conversationSummarySignature([])).toBe("");
    const first = conversationSummarySignature([
      { role: "user", content: [{ type: "text", text: "one" }] },
    ]);
    const second = conversationSummarySignature([
      { role: "user", content: [{ type: "text", text: "two" }] },
    ]);
    expect(first).not.toBe(second);
  });
});
