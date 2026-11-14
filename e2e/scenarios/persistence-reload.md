---
title: Conversation survives a page reload
start: /
max_steps: 20
---

## Steps
1. Close any welcome or tour dialog that is shown.
2. Send: "Remember the word: pineapple."
3. Wait until the answer has finished streaming.
4. Reload the page (goto the current URL).

## Expected
- After the reload the same conversation is shown with question and answer.
- The conversation is still listed in the sidebar.
