import { beforeEach, describe, expect, it } from "vitest";

import {
  clearFeedbackCursor,
  feedbackDelta,
  readFeedbackCursor,
  transcriptHash,
  writeFeedbackCursor,
} from "../feedbackCursor";

const messages = [
  { role: "user", content: "Question" },
  { role: "assistant", content: "Answer" },
];

beforeEach(() => {
  localStorage.clear();
});

describe("transcriptHash", () => {
  it("is stable for the same messages and differs when one changes", () => {
    expect(transcriptHash(messages)).toBe(transcriptHash([...messages]));
    expect(transcriptHash(messages)).not.toBe(
      transcriptHash([{ ...messages[0], content: "Other" }, messages[1]]),
    );
    expect(transcriptHash([...messages, { role: "user", content: "More" }]))
      .not.toBe(transcriptHash(messages));
  });

  it("has a fixed width so it stays small in storage", () => {
    expect(transcriptHash(messages)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("feedback cursor storage", () => {
  it("has no cursor before the first submission", () => {
    expect(readFeedbackCursor("conv-1")).toBeNull();
    expect(readFeedbackCursor("")).toBeNull();
  });

  it("round-trips the count and hash", () => {
    writeFeedbackCursor("conv-1", { count: 2, hash: "abcdef12" });

    expect(readFeedbackCursor("conv-1")).toEqual({
      count: 2,
      hash: "abcdef12",
    });
    expect(readFeedbackCursor("conv-2")).toBeNull();
  });

  it("ignores a stored value that is not a cursor", () => {
    localStorage.setItem(
      "chatai.feedback.cursors.v1",
      JSON.stringify({ "conv-1": { count: "two", hash: 3 } }),
    );

    expect(readFeedbackCursor("conv-1")).toBeNull();
  });

  it("clears one conversation without touching the others", () => {
    writeFeedbackCursor("conv-1", { count: 2, hash: "aaaaaaaa" });
    writeFeedbackCursor("conv-2", { count: 4, hash: "bbbbbbbb" });

    clearFeedbackCursor("conv-1");

    expect(readFeedbackCursor("conv-1")).toBeNull();
    expect(readFeedbackCursor("conv-2")).toEqual({
      count: 4,
      hash: "bbbbbbbb",
    });
  });

  it("keeps the store bounded", () => {
    for (let index = 0; index < 210; index += 1) {
      writeFeedbackCursor(`conv-${index}`, { count: index, hash: "cccccccc" });
    }

    expect(readFeedbackCursor("conv-0")).toBeNull();
    expect(readFeedbackCursor("conv-9")).toBeNull();
    expect(readFeedbackCursor("conv-209")).toEqual({
      count: 209,
      hash: "cccccccc",
    });
  });
});

describe("feedbackDelta", () => {
  const cursorFor = (count) => {
    writeFeedbackCursor("conv-1", {
      count,
      hash: transcriptHash(messages.slice(0, count)),
    });
    return readFeedbackCursor("conv-1");
  };

  it("returns only the turns after the cursor", () => {
    const cursor = { count: 1, hash: transcriptHash(messages.slice(0, 1)) };

    expect(feedbackDelta(messages, cursor)).toEqual([messages[1]]);
  });

  it("returns nothing when the chat was already delivered", () => {
    const cursor = { count: 2, hash: transcriptHash(messages) };

    expect(feedbackDelta(messages, cursor)).toEqual([]);
  });

  it("refuses a cursor without a matching prefix", () => {
    const edited = [{ ...messages[0], content: "Other" }, messages[1]];

    expect(
      feedbackDelta(edited, { count: 1, hash: transcriptHash(messages.slice(0, 1)) }),
    ).toBeNull();
  });

  it("refuses a cursor that is longer than the chat", () => {
    expect(
      feedbackDelta(messages, { count: 6, hash: transcriptHash(messages) }),
    ).toBeNull();
  });

  it("refuses an empty or missing cursor", () => {
    expect(feedbackDelta(messages, null)).toBeNull();
    expect(feedbackDelta(messages, { count: 0, hash: transcriptHash([]) })).toBeNull();
  });

  it("works together with the stored cursor", () => {
    const cursor = cursorFor(1);

    expect(feedbackDelta(messages, cursor)).toEqual([messages[1]]);
  });
});
