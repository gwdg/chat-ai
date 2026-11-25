---
title: Long multi-line prompt is handled
start: /
max_steps: 15
---

## Steps
1. Close any welcome or tour dialog that is shown.
2. Type a prompt of at least six lines, using Shift+Enter for new lines, ending with "Summarize this in one sentence."
3. Send it and wait until the answer has finished streaming.

## Expected
- The prompt box grows or scrolls without covering other controls.
- The user message keeps its line breaks.
- The answer is one sentence.
