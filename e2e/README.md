# VLM end-to-end tests

A vision-language model uses the Chat AI front end in a real browser (Playwright) and judges
markdown scenarios. Run manually against a local dev stack.

## Run
```
# needs front (:8080) and back (:8081) running, see AGENTS.md §3
cd e2e
npm i && npx playwright install chromium   # once
npm run e2e                                       # all scenarios
npm run e2e -- scenarios/chat-basic.md --headed
```
The VLM uses `apiEndpoint` + `apiKey` from `secrets/back.json`. Overrides via env:

| env                | default                  |
|--------------------|--------------------------|
| `E2E_APP_URL`      | `http://localhost:8080`  |
| `E2E_VLM_URL`      | `apiEndpoint` of back.json |
| `E2E_VLM_KEY`      | `apiKey` of back.json    |
| `E2E_VLM_MODEL`    | `gemma-4-31b-it`         |
| `E2E_BACK_CONFIG`  | `secrets/back.json`      |

Exit code is 1 if any scenario fails. `results/<timestamp>/index.html` shows per step the labeled
screenshot the VLM saw, its reasoning, action, errors, full prompt and raw reply.

## Scenarios
`scenarios/*.md`: YAML frontmatter + free markdown passed verbatim to the VLM.

| key         | values                  | default             |
|-------------|-------------------------|---------------------|
| `title`     | text                    | file name           |
| `start`     | path                    | `/`                 |
| `viewports` | list of `desktop`, `mobile` | both            |
| `language`  | `en`, `de-de`           | `en`                |
| `max_steps` | int                     | 25                  |

Write concrete `## Steps` and checkable `## Expected` bullets; the VLM only sees screenshots.

## How it works
- Each run gets a fresh browser context, so IndexedDB and localStorage start empty (no chats,
  first-visit dialogs appear). The UI language comes from the browser locale.
- Each step: interactive elements get numbered labels (set-of-marks); the VLM gets the
  screenshot, element list and action log and answers with one JSON action
  (`click`, `type`, `press`, `scroll`, `goto`, `wait`, `done`).
- Calls are stateless (one image per call) to bound cost; the log carries earlier reasoning.
- `checks.md` lists defects judged on every screenshot.
