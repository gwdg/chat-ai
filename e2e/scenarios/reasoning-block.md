---
title: Reasoning of a thinking model is shown collapsibly
start: /
max_steps: 25
---

## Steps
1. Close any welcome or tour dialog that is shown.
2. Pick a reasoning/thinking model in the model selector if one is available; otherwise finish with done.
3. Send: "Is 91 a prime number?"
4. Wait until the answer has finished streaming.
5. Expand and collapse the reasoning block.

## Expected
- The reasoning is in a separate, collapsible block, distinct from the answer.
- No raw `<think>` tags are visible.
- The final answer says 91 is not prime (7 × 13).
