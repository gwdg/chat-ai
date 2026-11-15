# End-to-end tests

Two suites live here:

- **`tests/`** — deterministic Playwright Test scenarios. Real clicks, explicit selectors,
  mocked upstream APIs. This is the default suite and needs no model or API key.
- **`scenarios/` + `src/`** — the VLM-driven suite, where a vision model clicks through markdown
  scenarios and judges screenshots. Slower, non-deterministic, run manually.

## Deterministic browser suite

Each user scenario is its own readable file in `tests/`, so it can be run alone:

| file | user action |
| --- | --- |
| `chat-send.spec.ts` | type a prompt, send it, see the streamed answer |
| `chat-persistence.spec.ts` | reload and find the exchange still there |
| `model-selector.spec.ts` | switch the conversation model |
| `theme-toggle.spec.ts` | toggle dark mode and keep it after a reload |
| `language-toggle.spec.ts` | switch the interface to German |
| `tutorial-select-model.spec.ts` | complete the one-step "Select a model" tutorial |
| `tutorial-search-chats.spec.ts` | complete the gated two-step "Search chats" tutorial |
| `tutorial-meta-chat-catalogs.spec.ts` | four-step catalog tutorial with two messages |
| `workspace-create.spec.ts` | create a workspace and open its file browser |
| `chat-file-upload.spec.ts` | attach a text file and send it with a prompt |
| `chat-html-rendering.spec.ts` | render a fenced HTML block in a sandboxed iframe |
| `chat-latex-rendering.spec.ts` | inline KaTeX math and a fenced LaTeX block |
| `chat-codemode-png.spec.ts` | create a PNG through the codemode tool in a workspace |
| `agent-opencode.spec.ts` | connect a local OpenCode agent and run a shell turn (opt-in) |

### Setup

```bash
cd e2e
npm run setup:e2e                        # Playwright chromium + firefox, verifies everything
npm run setup:e2e -- --with-deps         # also the host libraries (sudo)
npm run setup:e2e -- --webkit            # add WebKit
npm run setup:e2e -- --install-chrome    # add Google Chrome through apt
npm run analyze:check                    # verify only, install nothing
```

`scripts/install-browsers.sh` is idempotent and ends with the same launch/matrix check as
`npm run analyze:check`. The Chrome projects use `channel: "chrome"`, so a system Google Chrome must
be installed; the script reports it and can install it with `--install-chrome`.

`npm test:e2e` starts its own Vite dev server, so the normal front/back stack is **not** needed.
It uses `fixtures/front.e2e.json` (port 8090) via `CONFIG_LOCATION`, which overrides the usual
`secrets/front.json`.

### Run

```bash
cd e2e
npm run test:e2e:chrome                 # Chrome desktop + tablet + phone
npm run test:e2e                        # the same plus Firefox desktop
npm run test:e2e:ui                     # interactive Playwright UI
npm run analyze                         # check env, run all projects, summarise results

npx playwright test --project=chrome-desktop
npx playwright test tests/chat-send.spec.ts
npx playwright test tests/chat-send.spec.ts --project=chrome-phone
npm run test:e2e:report                 # last HTML report
npm run test:opencode                   # opt-in local agent scenario, see below
```

Results go to `e2e/results/` (gitignored): the HTML report under `results/html`, traces,
screenshots and videos of failures under `results/test-results`, and the analyser's JSON reports
plus `latest.json` under `results/analysis`.

### Documentation screenshots and narratives

Every run also writes user-facing documentation under
`results/documentation/<scenario>/<project>/`, for example:

```
results/documentation/chat-file-upload/chrome-desktop/
  index.md     # list of every documented step
  1.md         # what the user did and what the system answered
  1.png        # screenshot after that step
  2.md
  2.png
```

The folder name is the spec file without `.spec.ts`; the second level is the Playwright project,
so the same scenario can be compared across browsers and device classes (`chrome-desktop`,
`chrome-tablet`, `chrome-phone`, `firefox-desktop`). This output is documentation, not a test
artifact: the Markdown files describe the user input and the system response, and the screenshots
show the application state after the step.

`doc` is an automatic fixture. A scenario that calls `doc.step()` gets one screenshot and one
Markdown file per step:

```ts
await doc.step(
  "Attach a text file",
  {
    user: "The user attaches meeting-notes.txt.",
    system: "The file appears as an attachment card above the prompt box.",
  },
  async () => {
    await page.locator('input[type="file"]').setInputFiles(/* … */);
    await expect(card).toBeVisible();
  },
);
```

A scenario that does not call `doc.step()` still gets one automatic final screenshot, so no
scenario is left undocumented. Re-running a scenario replaces its folder. The output root can be
changed with `E2E_DOCUMENTATION_DIR`; `E2E_DOC_DEBUG=1` logs which folders are created.

### Analyser

`npm run analyze` checks the environment first, then runs the suite and reports per-project totals,
coverage gaps and the first lines of failures with their trace paths. It skips a project whose
browser cannot launch and says why instead of producing a wall of identical failures.

```bash
npm run analyze -- --check                     # environment only
npm run analyze -- --project=chrome-phone      # one project
npm run analyze -- --grep "workspace"          # one area
npm run analyze -- --json                      # machine-readable summary
```

`--check` verifies Playwright, the browser bundles, system Chrome, host libraries, the test matrix
read from the real config, and (when enabled) the local OpenCode server. A run without `--check`
writes `results/analysis/report-<timestamp>.json`, `run-<timestamp>.log` and `latest.json`.

### Projects (browsers and device classes)

| project | browser | viewport / device |
| --- | --- | --- |
| `chrome-desktop` | system Chrome | 1440 × 900 desktop |
| `chrome-tablet` | system Chrome | iPad Pro 11 landscape, 1194 × 834 |
| `chrome-phone` | system Chrome | Pixel 7 |
| `firefox-desktop` | Playwright Firefox | 1440 × 900 desktop |
| `opencode-local` | system Chrome | 1440 × 900, only with `E2E_OPENCODE=1` |

The tablet is deliberately 1194 px wide: the app's desktop breakpoint is 1280 px, so this exercises
the tablet layout (rail sidebar plus overlay drawer). A 1280 × 720 desktop is not used because the
Meta chat "What's new" panel squeezes the prompt row until the model chip covers the send button.

WebKit is opt-in because it needs host libraries that `npm i` does not install:

```bash
sudo npx playwright install-deps webkit
E2E_WEBKIT=1 npm run test:e2e
```

### Local OpenCode agent (opt-in)

`tests/agent-opencode.spec.ts` exercises the real browser→OpenCode path instead of mocking it. The
scenario adds an agent in **Local agent** mode with the server URL and password, checks that the
created session exists on the server, opens the agent page and runs a `!echo` shell turn, which
comes back through the same event stream as model replies.

```bash
opencode --version                       # must be on PATH
npm run test:opencode                    # starts opencode serve and runs the scenario
npm run opencode:serve                   # just the server, for manual poking
npm run opencode:check                   # probe a running server
```

`E2E_OPENCODE=1` adds the `opencode-local` project and a second Playwright `webServer` that runs
`scripts/opencode-server.mjs`. The wrapper binds `127.0.0.1:4096`, sets a fixed basic-auth password
so the test is deterministic, and waits for the server before the browser starts.

| env | default | meaning |
| --- | --- | --- |
| `E2E_OPENCODE` | unset | set to `1` to enable the project and web server |
| `E2E_OPENCODE_URL` | `http://127.0.0.1:4096` | use an already running server instead of starting one |
| `E2E_OPENCODE_USERNAME` | `opencode` | basic-auth user |
| `E2E_OPENCODE_PASSWORD` | `e2e-local-password` | basic-auth password |
| `E2E_OPENCODE_PORT` | `4096` | port the bundled server binds |
| `E2E_OPENCODE_PROJECT` | `results/opencode/project` | working directory for the server |

The shell turn is deliberate: it proves session creation, prompt delivery and event streaming
without depending on a model provider or network access. If `E2E_OPENCODE_URL` points at an
existing server, start it with the same password (`OPENCODE_SERVER_PASSWORD=... opencode serve`).

### Mocked upstream APIs and settings

`tests/fixtures.ts` registers `page.route` handlers before the first navigation, so no back service
is required:

- `GET /models` returns two models; the first **must** use the id configured as the default model
  (`deepseek-v4.1-flash-1017`). The app replaces an unknown stored model with a bare object and the
  selector then crashes on missing capability arrays.
- `GET /user` returns a fixed user.
- `POST /chat/completions` streams deterministic reply text and returns a fixed title for
  non-streaming calls.

`E2E_APP_URL` points the suite at an already running instance (for example a deployment) and skips
the bundled dev server.

### Layout helpers

`tests/fixtures.ts` also owns the device-class handling, because the app renders three different
sidebars and two model selectors:

- `openSidebar` / `closeSidebarOverlay` / `sidebarDrawerOpen` use the drawer's `translate-x-0`
  class. `isVisible()` reports a closed drawer as visible, since it is only translated off-screen.
- `showTutorialPanel` re-opens the drawer after a step needs content outside it (phone: hamburger,
  tablet: compact `Tutorial progress` rail button).
- `modelSelectorButton` returns the header picker below `md` and the prompt-box chip otherwise
  (the prompt chip is `hidden md:flex`).

## VLM end-to-end tests

A vision-language model uses the Chat AI front end in a real browser (Playwright) and judges
markdown scenarios. Run manually against a local dev stack.

### Run
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

### Scenarios
`scenarios/*.md`: YAML frontmatter + free markdown passed verbatim to the VLM.

| key         | values                  | default             |
|-------------|-------------------------|---------------------|
| `title`     | text                    | file name           |
| `start`     | path                    | `/`                 |
| `viewports` | list of `desktop`, `mobile` | both            |
| `language`  | `en`, `de-de`           | `en`                |
| `max_steps` | int                     | 25                  |

Write concrete `## Steps` and checkable `## Expected` bullets; the VLM only sees screenshots.

### How it works
- Each run gets a fresh browser context, so IndexedDB and localStorage start empty (no chats,
  first-visit dialogs appear). The UI language comes from the browser locale.
- Each step: interactive elements get numbered labels (set-of-marks); the VLM gets the
  screenshot, element list and action log and answers with one JSON action
  (`click`, `type`, `press`, `scroll`, `goto`, `wait`, `done`).
- Calls are stateless (one image per call) to bound cost; the log carries earlier reasoning.
- `checks.md` lists defects judged on every screenshot.
