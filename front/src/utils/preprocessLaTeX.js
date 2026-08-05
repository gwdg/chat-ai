/**
 * Converts LaTeX delimiters into the form that `remark-math` understands:
 *
 *   \[ ... \]  ->  $$ ... $$
 *   \( ... \)  ->  $  ...  $
 *
 * Why this is a scanner and not a chain of `String.replace` calls
 * ---------------------------------------------------------------
 * The previous implementation masked code blocks with placeholders, restored
 * them, and *then* ran global replacements over the whole string. Two classes
 * of bugs follow from that design:
 *
 *   1. Everything that is restored before the global replacements run gets
 *      rewritten again. That is how `\]` inside a JavaScript regex character
 *      class was destroyed (issue #146).
 *   2. The global replacements also rewrite the *inside* of a math region, and
 *      LaTeX math legitimately contains the byte sequence `\[` - the row
 *      separator `\\[4pt]` is `\\` (line break) followed by `[4pt]` (optional
 *      spacing). Rewriting it produced `\$$4pt]`, which terminates the math
 *      region early and garbles the rest of the block (issue #144).
 *
 * A replace-chain cannot tell those cases apart, because after the first pass
 * the output is fed back in as input. This module therefore walks the source
 * exactly once, left to right, and each region is classified before anything
 * is emitted. Text that is emitted is never looked at again, so no
 * transformation can cascade into another.
 *
 * Regions recognised by the scanner (all emitted verbatim unless noted):
 *   - fenced code blocks (``` and ~~~, 3 or more markers, any info string)
 *   - inline code spans (any number of backticks)
 *   - escape pairs `\x` - in particular `\\`, the LaTeX line break
 *   - display math \[ ... \] and $$ ... $$   (delimiters rewritten, body kept)
 *   - inline math  \( ... \)                 (delimiters rewritten, body kept)
 *
 * Known limitations (documented on purpose):
 *   - Indented (4-space) code blocks are not detected. Distinguishing them
 *     from indented list continuation lines needs a real block parser, and a
 *     false positive would break legitimate math inside list items.
 *   - Single-dollar math (`$x$`) is not parsed as a region, so the currency
 *     guard below still escapes `$` when it is directly followed by a digit.
 *     This matches the previous behaviour.
 */

/** Index of the `\n` that ends the line containing `from`, or the length. */
const lineEnd = (src, from) => {
  const nl = src.indexOf("\n", from);
  return nl === -1 ? src.length : nl;
};

/** Length of the run of `char` starting at `from`. */
const runLength = (src, from, char) => {
  let i = from;
  while (i < src.length && src[i] === char) i++;
  return i - from;
};

/**
 * If a fenced code block opens at `start` (which must be a line start),
 * returns the index just past its closing fence, otherwise null.
 *
 * An unclosed fence consumes the rest of the input, which is what CommonMark
 * does and what streaming responses need: while a code block is still being
 * streamed its closing fence has not arrived yet, and its content must stay
 * untouched in the meantime.
 */
const matchFencedCodeBlock = (src, start) => {
  const firstLine = src.slice(start, lineEnd(src, start));
  const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(firstLine);
  if (!opening) return null;

  const marker = opening[1];
  const info = opening[2];
  // A backtick fence may not carry backticks in its info string, otherwise
  // things like ``code`` would be mistaken for a fence.
  if (marker[0] === "`" && info.includes("`")) return null;

  const closingFence = new RegExp(
    `^ {0,3}${marker[0]}{${marker.length},}[ \\t]*$`
  );

  let pos = lineEnd(src, start);
  while (pos < src.length) {
    pos += 1; // step over the newline
    const end = lineEnd(src, pos);
    if (closingFence.test(src.slice(pos, end))) return end;
    pos = end;
  }
  return src.length;
};

/**
 * If a code span opens at `start`, returns the index just past its closing
 * backtick run, otherwise null. A code span closes on a run of exactly the
 * same length and may not contain a blank line.
 */
const matchCodeSpan = (src, start) => {
  const fence = runLength(src, start, "`");
  let i = start + fence;

  while (i < src.length) {
    if (src[i] === "`") {
      const run = runLength(src, i, "`");
      if (run === fence) return i + run;
      i += run;
      continue;
    }
    if (src[i] === "\n" && /^[ \t]*\n/.test(src.slice(i + 1))) return null;
    i++;
  }
  return null;
};

/**
 * Index of the closing `\<close>` for a math region that starts at `from`,
 * or -1. Escape pairs are consumed as a unit, so the `\\` of a LaTeX line
 * break can never pair up with the character behind it.
 */
const findMathEnd = (src, from, close) => {
  let i = from;
  while (i < src.length) {
    if (src[i] !== "\\") {
      i++;
      continue;
    }
    if (src[i + 1] === close) return i;
    i += 2; // `\\`, `\[`, `\{`, ... - always skipped as a pair
  }
  return -1;
};

/** Index just past the closing `$$` of a block starting at `from`, or -1. */
const findDollarBlockEnd = (src, from) => {
  const close = src.indexOf("$$", from);
  return close === -1 ? -1 : close + 2;
};

export const preprocessLaTeX = (content) => {
  if (!content) return "";

  const src = String(content);
  const out = [];
  let i = 0;

  while (i < src.length) {
    const char = src[i];
    const atLineStart = i === 0 || src[i - 1] === "\n";

    // ---- fenced code block -------------------------------------------------
    if (atLineStart && (char === "`" || char === "~" || char === " ")) {
      const end = matchFencedCodeBlock(src, i);
      if (end !== null) {
        out.push(src.slice(i, end));
        i = end;
        continue;
      }
    }

    // ---- inline code span --------------------------------------------------
    if (char === "`") {
      const end = matchCodeSpan(src, i);
      if (end !== null) {
        out.push(src.slice(i, end));
        i = end;
        continue;
      }
      // Unbalanced backticks are literal text.
      const run = runLength(src, i, "`");
      out.push(src.slice(i, i + run));
      i += run;
      continue;
    }

    // ---- backslash: escape pair or math delimiter --------------------------
    if (char === "\\") {
      const next = src[i + 1];

      if (next === "[" || next === "(") {
        const close = next === "[" ? "]" : ")";
        const bodyStart = i + 2;
        const closeAt = findMathEnd(src, bodyStart, close);
        if (closeAt !== -1) {
          const delimiter = next === "[" ? "$$" : "$";
          // The body is copied verbatim - `\\[4pt]`, `\left[`, `\{` and every
          // other backslash sequence inside math stays exactly as written.
          out.push(delimiter, src.slice(bodyStart, closeAt), delimiter);
          i = closeAt + 2;
          continue;
        }
        // No closing delimiter (yet): keep it literal instead of emitting a
        // dangling `$$` that would swallow the rest of the document.
        out.push(src.slice(i, i + 2));
        i += 2;
        continue;
      }

      if (next === undefined) {
        out.push(char);
        i += 1;
        continue;
      }

      // Any other escape pair, `\\` included, is passed through untouched.
      out.push(src.slice(i, i + 2));
      i += 2;
      continue;
    }

    // ---- $$ ... $$ is already math: never touch its body -------------------
    if (char === "$" && src[i + 1] === "$") {
      const end = findDollarBlockEnd(src, i + 2);
      if (end !== -1) {
        out.push(src.slice(i, end));
        i = end;
        continue;
      }
      out.push("$$");
      i += 2;
      continue;
    }

    // ---- currency guard: `$5` must not open a math region ------------------
    if (char === "$" && src[i + 1] >= "0" && src[i + 1] <= "9") {
      out.push("\\$");
      i += 1;
      continue;
    }

    out.push(char);
    i += 1;
  }

  return out.join("");
};

export default preprocessLaTeX;
