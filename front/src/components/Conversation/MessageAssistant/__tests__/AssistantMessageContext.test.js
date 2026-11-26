import { describe, expect, it } from "vitest";

import { resolveMessageIndex } from "../AssistantMessageContext";

const messages = [
  { id: "m-1", role: "user" },
  { role: "assistant" },
  { role: "user" },
];

describe("resolveMessageIndex", () => {
  it("finds a stored message by id", () => {
    expect(resolveMessageIndex(messages, { messageId: "m-1" })).toBe(0);
  });

  it("falls back to the position while a reply has no id yet", () => {
    expect(
      resolveMessageIndex(messages, { messageId: null, fallbackIndex: 1 }),
    ).toBe(1);
  });

  it("refuses a position that holds no message", () => {
    expect(
      resolveMessageIndex(messages, { messageId: null, fallbackIndex: 9 }),
    ).toBe(-1);
    expect(
      resolveMessageIndex([], { messageId: null, fallbackIndex: 0 }),
    ).toBe(-1);
    expect(resolveMessageIndex(undefined, { fallbackIndex: 0 })).toBe(-1);
  });

  it("does not fall back to the position for an id that is gone", () => {
    expect(
      resolveMessageIndex(messages, { messageId: "m-2", fallbackIndex: 1 }),
    ).toBe(-1);
  });
});
