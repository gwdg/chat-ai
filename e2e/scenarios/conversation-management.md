---
title: User starts a new chat and deletes an old one
start: /
max_steps: 25
---

## Steps
1. Close any welcome or tour dialog that is shown.
2. Send: "Say hi."
3. Wait until the answer has finished streaming.
4. Start a new conversation from the sidebar.
5. Delete the first conversation from the sidebar and confirm if asked.

## Expected
- After step 4 an empty conversation is shown.
- After step 5 the deleted conversation is gone from the sidebar.
- No error message is shown.
