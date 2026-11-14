---
title: User edits a sent message and gets a new answer
start: /
max_steps: 25
---

## Steps
1. Close any welcome or tour dialog that is shown.
2. Send: "Name one fruit."
3. Wait until the answer has finished streaming.
4. Edit your message to "Name one vegetable." and resend it.
5. Wait until the answer has finished streaming.

## Expected
- The user message now reads "Name one vegetable.".
- The new answer names a vegetable.
- The old answer about a fruit is no longer shown as the latest answer.
