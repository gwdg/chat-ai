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
| `chat-persistence.spec.ts` | send a prompt, then reload and find the exchange still there |
| `mcp-persistence.spec.ts` | a configured MCP server survives a reload, also with a second tab open |
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
| `agent-agentic-tasks.spec.ts` | a local OpenCode agent writes, runs and edits a script (opt-in) |
| `chat-real-model.spec.ts` | ask a real model behind your own back service (opt-in) |

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
npx playwright test tests/chat-persistence.spec.ts
npx playwright test tests/chat-persistence.spec.ts --project=chrome-phone
npm run test:e2e:report                 # last HTML report
npm run test:opencode                   # opt-in local agent scenario, see below
npm run test:real                       # opt-in real-model scenario, see below
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

#### Automatic visual verification

Screenshots are checked against the narrative with the SAIA Gemma vision model
(`gemma-4-31b-it`). Add a `shows` sentence to a step and the recorded image is sent to the model
after the test finishes:

```ts
await doc.step(
  "Open the tutorial catalog",
  {
    user: "The user clicks the tutorials button above the prompt box.",
    system: "The catalog opens and the guide advances to Step 2 of 4.",
    shows: "the Meta chat with the tutorial catalog open above the prompt input",
  },
  async () => {
    /* … */
  },
);
```

Every step with `shows` gets a `## Visual check` section in its Markdown file, containing the
expectation and the model's verdict. A `NO` verdict (or a persistent API error) fails the test when
the test itself passed, so a screenshot that shows the wrong layout — for example the phone sidebar
drawer covering the Meta chat — cannot silently reach the documentation.

Credentials are read at runtime from `secrets/back.json` (`apiEndpoint` + `apiKey`), the same file
the back proxy uses. They are never copied into the repository. Override them with environment
variables:

| env | default | meaning |
| --- | --- | --- |
| `E2E_VISION` | `auto` | `auto` enables the checks when credentials exist; `1` requires them; `0` disables them |
| `SAIA_API_ENDPOINT` | `apiEndpoint` from `back.json` | OpenAI-compatible base URL |
| `SAIA_API_KEY` | `apiKey` from `back.json` | API key for the vision model |
| `E2E_VISION_MODEL` | `gemma-4-31b-it` | model that answers the checks |
| `E2E_VISION_CONCURRENCY` | `3` | parallel requests per worker |

```bash
npm run test:e2e                         # checks on when credentials are available
E2E_VISION=0 npm run test:e2e            # documentation only, no model calls
E2E_VISION=1 npm run test:e2e            # fail if the checks cannot run
```

The checks run in the fixture teardown, in parallel and with retries for transport errors. They are
part of the normal suite, so a scenario's own `test.slow()` and the bumped test timeout cover them.

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
| `real-model` | system Chrome | 1440 × 900, only with `E2E_REAL_MODEL=1` |

The two opt-in modes replace the mocked matrix for that run: they start their own app instance
(`opencode-local` uses the mocked one plus a real local OpenCode server, `real-model` uses the app
built against your back service).

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
scenario adds an agent in **OpenCode server** mode with the server URL and password, checks that the
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

#### Agentic tasks with a scripted model

`tests/agent-agentic-tasks.spec.ts` goes one step further and sends a **prompt**, so OpenCode has
to run a real tool loop. A real model would make that non-deterministic, so the run also starts
`scripts/scripted-model.mjs`: an OpenAI-compatible server that answers with a fixed script —

1. `write hello.py`, then `shell python3 hello.py`, then `read hello.py`, then a text answer;
2. on the second prompt, `edit hello.py`, run it again, and report the new output.

OpenCode executes those tools itself, so the file on disk, the exit status, the tool results and
the rendered cards are genuine; only the choice of tool is scripted. The scenario adds an agent,
opens its page, expands the `write`, `shell` and `read` cards, previews `hello.py` in the docked
panel, edits the greeting and checks the file on disk both times.

`scripts/opencode-server.mjs` writes the `scripted` provider into the project's `opencode.json`
when `E2E_SCRIPTED_MODEL_URL` is set, which Playwright does for this run. Start the two specs
separately or together:

```bash
npm run test:opencode           # both local-agent specs
npm run test:opencode:agentic   # only the agentic scenario
```

| env | default | meaning |
| --- | --- | --- |
| `E2E_SCRIPTED_MODEL_URL` | `http://127.0.0.1:4100` | an already running scripted model; when set, the bundled one is not started |
| `E2E_SCRIPTED_MODEL_PORT` | `4100` | port the bundled scripted model binds |

With `E2E_OPENCODE_URL` set, the agentic scenario skips itself: a server you started has to
configure the `scripted` provider (and `scripted/agentic` as a model) on its own.

### Real model behind a back service you started (opt-in)

The default suite replaces the model with mocks; that is what makes it deterministic. To exercise
the real thing, start the back proxy yourself (it reads the API key from `secrets/back.json`) and
run the real-model mode **instead**:

```bash
cd back && npm run start                 # :8081
cd e2e  && npm run test:real             # E2E_REAL_MODEL=1, project=real-model
```

The two are separate modes, not layers. `npm run test:e2e` starts the mocked app on port 8090 and
runs the 13 deterministic scenarios; `npm run test:real` starts a second app instance on port 8092
whose config points at `E2E_BACKEND_URL`, runs only `chat-real-model.spec.ts`, and does not start
the mocked instance. Combining them (or either with `E2E_OPENCODE=1`) in one run is refused with a
clear config error, because each mode needs its own app instance.

The front end reads its backend URLs at Vite startup, so the real-mode config is generated from
`fixtures/front.e2e.json` into `results/front.e2e-real.json` (gitignored): `backendPath` becomes
`E2E_BACKEND_URL`, `modelsPath` and `userDataPath` become its `/models` and `/user` routes, and the
title/chat model id becomes `E2E_REAL_MODEL_ID`. Everything else — modules, prompt defaults, the
announcement — stays the same, so the scenario renders the same app.

`tests/chat-real-model.spec.ts` asks "What is 17 + 25? Reply with just the number." and checks that

- the model chip is no longer "Alpha Mock Model", so `/models` really came from your backend,
- the streamed answer contains `42`, i.e. the model's own output rather than a fixture,
- no `Mocked reply` text appears anywhere.

Documentation and the Gemma vision check still run, so the mode writes
`results/documentation/chat-real-model/real-model/` and its `shows` sentence is verified against the
real answer. The wording is not deterministic, which is exactly why this mode is separate from the
default matrix.

Documentation folders are keyed by scenario and project only, and the real-mode projects reuse the
mocked device names (`chrome-tablet`, …). Running the other mode therefore replaces the screenshots
in the same folder; re-run the mode whose output you want to keep.

| env | default | meaning |
| --- | --- | --- |
| `E2E_REAL_MODEL` | unset | `1` switches the run to the real-model mode |
| `E2E_BACKEND_URL` | `http://127.0.0.1:8081` | back service that holds the API key |
| `E2E_REAL_MODEL_ID` | `default.model.id` from `fixtures/front.e2e.json` | model id for the conversation and title generation; the matching entry from the real `/models` response replaces it, and the app falls back to the first listed model |
| `E2E_REAL_APP_URL` | `http://127.0.0.1:8092` | app instance to test, when you serve the build yourself |
| `E2E_APP_URL` | unset | test an already running app instance; no dev server is started, and the real mode uses it as well if `E2E_REAL_APP_URL` is unset |

`npm run analyze:check` probes the backend in this mode and fails with the reason when `/models`
returns no models. The status is always 200 — even for a rejected key — so the check reads the body.

### Mocked upstream APIs and settings

`tests/fixtures.ts` registers `page.route` handlers before the first navigation, so no back service
is required:

- `GET /models` returns two models; the first **must** use the id configured as the default model
  (`deepseek-v4.1-flash-1017`). The app replaces an unknown stored model with a bare object and the
  selector then crashes on missing capability arrays.
- `GET /user` returns a fixed user.
- `POST /chat/completions` streams deterministic reply text and returns a fixed title for
  non-streaming calls.

The handlers come from the `mockUpstream` option fixture, which is `true` by default. The opt-in
`real-model` project sets it to `false`, so those three requests go to the back service instead of
being intercepted; everything else (browser state, documentation, vision checks) is the same.

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
