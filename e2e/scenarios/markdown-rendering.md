---
title: Markdown, code and math in answers are rendered
start: /
max_steps: 20
---

## Steps
1. Close any welcome or tour dialog that is shown.
2. Send: "Reply with a markdown table of three planets and their diameter, a Python code block that prints hello, and the formula $E = mc^2$."
3. Wait until the answer has finished streaming.

## Expected
- The table is rendered as a table, not as `|---|` text.
- The code block is shown in a code box with a copy button.
- The formula is typeset, not shown as raw `$...$` or LaTeX source.
