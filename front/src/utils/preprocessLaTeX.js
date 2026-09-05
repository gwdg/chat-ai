/**
 * Converts LaTeX delimiters into the form that `remark-math` understands:
 *
 *   \[ ... \]  ->  $$ ... $$
 *   \( ... \)  ->  $  ...  $
 *
 * Known limitations (documented on purpose):
 *   - Indented (4-space) code blocks are not detected. Distinguishing them
 *     from indented list continuation lines needs a real block parser, and a
 *     false positive would break legitimate math inside list items.
 *   - The currency guard still escapes `$` when it is directly followed by a
 *     digit, so `$5x$` is money and not math. Without that rule "you have $5
 *     and I have $10" turns into math.
 *   - A `\( ... \)` region that spans a line break *and* contains a dollar
 *     sign only after that break can produce an opening `$$` whose line holds
 *     no other dollar, which `remark-math` then reads as a display block.
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

/**
 * Index of the `$` that closes an inline math region whose body starts at
 * `from`, or -1. Escape pairs are consumed as a unit, so `\$` is part of the
 * body and not a delimiter. A blank line ends the paragraph and with it any
 * chance of a closing delimiter.
 */
const findInlineDollarEnd = (src, from) => {
  let i = from;
  while (i < src.length) {
    const char = src[i];
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === "$") return i;
    if (char === "\n" && /^[ \t]*\n/.test(src.slice(i + 1))) return -1;
    i++;
  }
  return -1;
};

/** Length of the longest run of `$` in `body`. */
const maxDollarRun = (body) => {
  let longest = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "$") continue;
    const run = runLength(body, i, "$");
    if (run > longest) longest = run;
    i += run - 1;
  }
  return longest;
};

/**
 * Wraps a math body in a delimiter run that `remark-math` cannot close early.
 * `minSize` is 1 for inline and 2 for display math; the run grows past that
 * only when the body itself contains dollars, so ordinary math keeps the
 * shortest possible delimiters.
 */
const wrapMath = (body, minSize) => {
  const run = maxDollarRun(body);
  if (run === 0) {
    const fence = "$".repeat(minSize);
    return fence + body + fence;
  }
  const fence = "$".repeat(Math.max(minSize, run + 1));
  return `${fence} ${body} ${fence}`;
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
          // The body is copied verbatim - `\\[4pt]`, `\left[`, `\{` and every
          // other backslash sequence inside math stays exactly as written.
          out.push(wrapMath(src.slice(bodyStart, closeAt), next === "[" ? 2 : 1));
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

    // ---- $ ... $ inline math -----------------------------------------------
    // Recognising the region is what makes `\$` inside it survive: the body is
    // re-emitted with delimiters that cannot be closed by an escaped dollar.
    // A region opens only on a non-space character and closes only on one, the
    // rule TeX-aware markdown flavours use to keep "$ 5" and "5 $" out of math.
    if (char === "$") {
      const next = src[i + 1];
      if (next !== undefined && !/\s/.test(next)) {
        const closeAt = findInlineDollarEnd(src, i + 1);
        if (closeAt !== -1 && !/\s/.test(src[closeAt - 1])) {
          out.push(wrapMath(src.slice(i + 1, closeAt), 1));
          i = closeAt + 1;
          continue;
        }
      }
    }

    out.push(char);
    i += 1;
  }

  return out.join("");
};

export default preprocessLaTeX;
