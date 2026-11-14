---
title: Assistant keeps context across turns
start: /
max_steps: 25
---

## Steps
1. Close any welcome or tour dialog that is shown.
2. Send: "My name is Alex."
3. Wait until the answer has finished streaming.
4. Send: "What is my name?"
5. Wait until the answer has finished streaming.

## Expected
- The second answer contains "Alex".
- Both turns are shown in order.
