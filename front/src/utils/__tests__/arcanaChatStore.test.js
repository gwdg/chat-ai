import { beforeEach, describe, expect, it } from "vitest";

import {
  arcanaChatConversationId,
  clearArcanaChat,
  createArcanaChatState,
  loadArcanaChat,
  saveArcanaChat,
} from "../arcanaChatStore";

describe("arcanaChatStore", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("keeps a thread per collection and never a compiled state", () => {
    saveArcanaChat("tester__test", {
      messages: [
        { role: "system", content: [{ type: "text", text: "sys" }] },
        { role: "user", content: [{ type: "text", text: "hi" }] },
        {
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
          loading: true,
        },
      ],
      settings: { temperature: 0.2 },
    });

    const restored = loadArcanaChat("tester__test");
    expect(restored.messages).toHaveLength(3);
    expect(restored.messages[2].loading).toBe(false);
    expect(restored.settings.temperature).toBe(0.2);

    expect(loadArcanaChat("someone-else__test")).toBeNull();
  });

  it("drops an unreadable or too-short thread", () => {
    sessionStorage.setItem("chatai.arcana-chat:tester__test", "{not json");
    expect(loadArcanaChat("tester__test")).toBeNull();

    saveArcanaChat("tester__test", {
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    });
    expect(loadArcanaChat("tester__test")).toBeNull();
  });

  it("clears only the requested collection", () => {
    saveArcanaChat("a__x", {
      messages: [
        { role: "system", content: [{ type: "text", text: "sys" }] },
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ],
    });
    saveArcanaChat("b__y", {
      messages: [
        { role: "system", content: [{ type: "text", text: "sys" }] },
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ],
    });
    clearArcanaChat("a__x");
    expect(loadArcanaChat("a__x")).toBeNull();
    expect(loadArcanaChat("b__y")).not.toBeNull();
  });

  it("uses a stable file namespace for the collection", () => {
    expect(arcanaChatConversationId("tester__test")).toBe(
      "arcana-chat:tester__test",
    );
    const state = createArcanaChatState("tester__test", {}, "Test");
    expect(state.id).toBe("arcana-chat:tester__test");
    expect(state.title).toBe("Test");
    expect(state.messages.length).toBeGreaterThanOrEqual(2);
  });
});
