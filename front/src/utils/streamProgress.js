// Progress reporting for model answers that are rendered while they stream in.
//
// The dialogs that block on a single model answer show how much of it already
// arrived. Counting is throttled so a fast stream does not re-render the dialog
// on every chunk.

export function countWords(text) {
  const trimmed = (text ?? "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Accumulates streamed text and reports `{ words, reasoningWords, chars,
 * elapsedMs }` at most every `interval` ms. `flush()` forces the final report.
 */
export function createProgressReporter({
  onProgress,
  interval = 150,
  startedAt = Date.now(),
} = {}) {
  let answer = "";
  let reasoning = "";
  let lastReportAt = 0;

  const report = (force = false) => {
    if (typeof onProgress !== "function") return;
    const now = Date.now();
    if (!force && now - lastReportAt < interval) return;
    lastReportAt = now;
    onProgress({
      words: countWords(answer),
      reasoningWords: countWords(reasoning),
      chars: answer.length,
      elapsedMs: now - startedAt,
    });
  };

  return {
    appendAnswer(text) {
      if (typeof text !== "string") return;
      answer += text;
      report();
    },
    appendReasoning(text) {
      if (typeof text !== "string") return;
      reasoning += text;
      report();
    },
    setAnswer(text) {
      answer = typeof text === "string" ? text : "";
      report(true);
    },
    reset() {
      answer = "";
      reasoning = "";
      lastReportAt = 0;
    },
    flush() {
      report(true);
    },
    get answer() {
      return answer;
    },
    get reasoning() {
      return reasoning;
    },
  };
}
