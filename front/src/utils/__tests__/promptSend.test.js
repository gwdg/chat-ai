import { describe, expect, it, vi } from "vitest";

import { buildPromptState, sendPrompt } from "../promptSend";

const state = (messages) => ({ id: "chat-1", messages });

const draft = (content) => ({ role: "user", content });

describe("buildPromptState", () => {
  it("writes into the trailing user draft and keeps its attachments", () => {
    const localState = state([
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
      draft([
        { type: "text", text: "I am working on" },
        { type: "file", fileId: "file-1" },
      ]),
    ]);

    const next = buildPromptState(localState, " pointers ");

    expect(next.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: "I am working on\n\npointers" },
        { type: "file", fileId: "file-1" },
      ],
    });
    // The original state is not mutated.
    expect(localState.messages.at(-1).content[0].text).toBe("I am working on");
  });

  it("replaces an empty draft with the prompt", () => {
    const next = buildPromptState(
      state([draft([{ type: "text", text: "" }])]),
      "give me a question",
    );
    expect(next.messages[0].content).toEqual([
      { type: "text", text: "give me a question" },
    ]);
  });

  it("refuses an empty prompt, a running turn, or no trailing user message", () => {
    expect(buildPromptState(state([draft([{ type: "text", text: "x" }])]), "")).toBeNull();
    expect(
      buildPromptState(
        state([
          draft([{ type: "text", text: "x" }]),
          { role: "assistant", content: [], loading: true },
        ]),
        "prompt",
      ),
    ).toBeNull();
    expect(
      buildPromptState(
        state([{ role: "assistant", content: [{ type: "text", text: "a" }] }]),
        "prompt",
      ),
    ).toBeNull();
    expect(buildPromptState({}, "prompt")).toBeNull();
  });
});

describe("sendPrompt", () => {
  it("updates the draft and starts the send", async () => {
    const localState = state([draft([{ type: "text", text: "" }])]);
    const setLocalState = vi.fn();
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    const sent = await sendPrompt({
      localState,
      setLocalState,
      sendMessage,
      prompt: "quiz me",
    });

    expect(sent).toBe(true);
    expect(setLocalState).toHaveBeenCalledWith(
      expect.objectContaining({ messages: expect.any(Array) }),
    );
    expect(sendMessage).toHaveBeenCalledWith({
      localState: setLocalState.mock.calls[0][0],
      setLocalState,
    });
  });

  it("does nothing while the chat is not ready", async () => {
    const setLocalState = vi.fn();
    const sendMessage = vi.fn();

    const sent = await sendPrompt({
      localState: state([{ role: "assistant", content: [] }]),
      setLocalState,
      sendMessage,
      prompt: "quiz me",
    });

    expect(sent).toBe(false);
    expect(setLocalState).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
