import { describe, expect, it, vi } from "vitest";
import { countWords, createProgressReporter } from "../streamProgress";

describe("countWords", () => {
  it("counts whitespace separated words and ignores padding", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n ")).toBe(0);
    expect(countWords("  two words ")).toBe(2);
    expect(countWords("a\nb\tc")).toBe(3);
  });
});

describe("createProgressReporter", () => {
  it("reports the accumulated answer", () => {
    const reports = [];
    const progress = createProgressReporter({
      onProgress: (snapshot) => reports.push(snapshot),
    });

    progress.appendAnswer("one two");
    progress.flush();

    expect(reports.at(-1)).toMatchObject({ words: 2, chars: 7 });
  });

  it("throttles rapid updates but always flushes the final state", () => {
    const reports = [];
    const progress = createProgressReporter({
      onProgress: (snapshot) => reports.push(snapshot),
      interval: 1000,
    });

    progress.appendAnswer("one");
    progress.appendAnswer(" two");
    progress.appendAnswer(" three");
    expect(reports).toHaveLength(1);

    progress.flush();
    expect(reports).toHaveLength(2);
    expect(reports.at(-1).words).toBe(3);
  });

  it("clears the accumulator on reset", () => {
    const reports = [];
    const progress = createProgressReporter({
      onProgress: (snapshot) => reports.push(snapshot),
    });

    progress.appendAnswer("stale words here");
    progress.reset();
    progress.appendAnswer("fresh");
    progress.flush();

    expect(progress.answer).toBe("fresh");
    expect(reports.at(-1).words).toBe(1);
  });

  it("tracks reasoning separately from the answer", () => {
    const reports = [];
    const progress = createProgressReporter({
      onProgress: (snapshot) => reports.push(snapshot),
    });

    progress.appendReasoning("thinking it over");
    expect(reports.at(-1)).toMatchObject({ words: 0, reasoningWords: 3 });
  });

  it("does nothing without a progress callback", () => {
    const progress = createProgressReporter();
    expect(() => {
      progress.appendAnswer("hello");
      progress.flush();
    }).not.toThrow();
    expect(progress.answer).toBe("hello");
  });

  it("ignores non-string chunks", () => {
    const progress = createProgressReporter({ onProgress: vi.fn() });
    progress.appendAnswer(undefined);
    progress.appendAnswer(null);
    expect(progress.answer).toBe("");
  });
});
