/**
 * Run with: npm run test  (uses the Node built-in test runner, no extra deps)
 */
import test from "node:test";
import assert from "node:assert/strict";

import { preprocessLaTeX } from "./preprocessLaTeX.js";

test("converts display math delimiters", () => {
  assert.equal(preprocessLaTeX(String.raw`\[x+1\]`), "$$x+1$$");
});

test("converts inline math delimiters", () => {
  assert.equal(preprocessLaTeX(String.raw`text \(v_i(G)\) more`), "text $v_i(G)$ more");
});

test("issue #144: keeps the LaTeX row separator \\\\[4pt] inside math", () => {
  const input = String.raw`\[
\begin{aligned}
a &= b,\\[4pt]
c &= d
\end{aligned}
\]`;
  const expected = `$$
\\begin{aligned}
a &= b,\\\\[4pt]
c &= d
\\end{aligned}
$$`;
  assert.equal(preprocessLaTeX(input), expected);
});

test("issue #144: \\Bigl[ ... \\Bigr] inside math survives", () => {
  const input = String.raw`\[a_i\Bigl[\frac12 G^{-1/2}\Bigr]=0\]`;
  assert.equal(
    preprocessLaTeX(input),
    String.raw`$$a_i\Bigl[\frac12 G^{-1/2}\Bigr]=0$$`
  );
});

test("issue #146: fenced code block with a regex character class is untouched", () => {
  // Written without String.raw because the source contains "${".
  const input = ["```js", "const re = /[.*+?^${}()|[\\]\\\\]/g;", "```"].join(
    "\n"
  );
  assert.equal(preprocessLaTeX(input), input);
});

test("issue #146: inline code span is untouched", () => {
  const input = "use `|[\\]\\\\]/g` here";
  assert.equal(preprocessLaTeX(input), input);
});

test("code spans with multiple backticks are untouched", () => {
  const input = "``a `b` \\[c\\]`` and \\(d\\)";
  assert.equal(preprocessLaTeX(input), "``a `b` \\[c\\]`` and $d$");
});

test("tilde fences and fences longer than three markers are untouched", () => {
  const input = ["~~~text", String.raw`\[not math\]`, "~~~"].join("\n");
  assert.equal(preprocessLaTeX(input), input);
  const long = ["````", String.raw`\(x\)`, "````"].join("\n");
  assert.equal(preprocessLaTeX(long), long);
});

test("indented fences are recognised", () => {
  const input = ["   ```js", String.raw`/[\]]/`, "   ```"].join("\n");
  assert.equal(preprocessLaTeX(input), input);
});

test("an unclosed fence (streaming) protects the rest of the input", () => {
  const input = ["```js", String.raw`const re = /[\]]/g;`].join("\n");
  assert.equal(preprocessLaTeX(input), input);
});

test("math outside code is still converted when code is present", () => {
  const input = [
    String.raw`\(a\)`,
    "```js",
    String.raw`/[\]]/`,
    "```",
    String.raw`\[b\]`,
  ].join("\n");
  const expected = ["$a$", "```js", String.raw`/[\]]/`, "```", "$$b$$"].join(
    "\n"
  );
  assert.equal(preprocessLaTeX(input), expected);
});

test("existing $$ blocks are passed through unchanged", () => {
  const input = String.raw`$$\begin{aligned}a\\[4pt]b\end{aligned}$$`;
  assert.equal(preprocessLaTeX(input), input);
});

test("a dollar sign before a digit is escaped, elsewhere it is kept", () => {
  assert.equal(preprocessLaTeX("costs $5 and $10"), "costs \\$5 and \\$10");
  assert.equal(preprocessLaTeX("a $ b"), "a $ b");
});

test("dollar amounts inside code are not escaped", () => {
  assert.equal(preprocessLaTeX("`$5`"), "`$5`");
});

test("dollar amounts inside math are not escaped", () => {
  assert.equal(preprocessLaTeX(String.raw`\[12\,000$5\]`), "$$12\\,000$5$$");
});

test("an unmatched opening delimiter stays literal", () => {
  assert.equal(preprocessLaTeX(String.raw`\[ still streaming`), String.raw`\[ still streaming`);
});

test("a stray closing delimiter stays literal", () => {
  assert.equal(preprocessLaTeX(String.raw`array\] end`), String.raw`array\] end`);
});

test("markdown escapes outside math are preserved", () => {
  assert.equal(preprocessLaTeX(String.raw`\*not italic\* \_x\_`), String.raw`\*not italic\* \_x\_`);
});

test("empty and non-string input", () => {
  assert.equal(preprocessLaTeX(""), "");
  assert.equal(preprocessLaTeX(null), "");
  assert.equal(preprocessLaTeX(undefined), "");
});

test("issue #144: full report from the user", () => {
  const input = String.raw`Wir maximieren \(v_i(G)\) nach \(G\).

\[
\begin{aligned}
v_i(G) &= a_i\,G^{1/2}(12\,000-G),\qquad
a_i\equiv\frac{y_i}{12\,000}>0,\\[4pt]
\frac{dv_i}{dG} &= a_i\Bigl[\frac12 G^{-1/2}(12\,000-G)-G^{1/2}\Bigr]=0 .
\end{aligned}
\]

Setzen wir \(\frac{dv_i}{dG}=0\) und multiplizieren mit \(2G^{1/2}\):`;

  const output = preprocessLaTeX(input);
  assert.ok(output.includes(String.raw`\\[4pt]`), "row separator must survive");
  assert.ok(output.includes(String.raw`\Bigl[`), "\\Bigl[ must survive");
  assert.ok(!output.includes("$$4pt"), "no delimiter may be injected into math");
  assert.equal((output.match(/\$\$/g) || []).length, 2, "exactly one $$ pair");
});
