# AGENTS.md

Guide for AI coding agents working in this repository. Read this before touching code.
Every statement here was checked against the code; see §8 before adding to it.
Human-facing docs: [README.md](README.md) (install/config), [CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md).

## 1. What this repo is

The stand-alone **web interface of Chat AI** (GWDG / SAIA) — a browser chat client for any
OpenAI-compatible API endpoint. It is one of three repos in the wider architecture:

| Repo | Contents |
| --- | --- |
| **this one** (`gwdg/chat-ai`) | web interface: `front` + `back` |
| `gwdg/saia-hub` | API gateway, SSH proxy |
| `gwdg/saia-hpc` | Slurm scheduler + HPC scripts |

Two services, no monorepo tooling — each has its own `package.json` and is installed separately:

- **`front/`** — React 19 SPA, Vite 7, runs entirely in the user's browser. All chat data is local.
- **`back/`** — single-file Express 4 proxy (`back/service.mjs`, 412 lines). Per README it exists to
  hold the API key server-side and to prevent CORS errors in the user's browser.

## 2. Layout

```
front/src/
  Pages/          route-level screens (ChatPage.tsx is the app)
  Route/          PublicRoute.tsx — all routes
  components/     UI, grouped by screen area: Header/ Sidebar/ Conversation/ Prompt/ SettingsPanel/ Footer/ Others/
  modals/         ModalContext.jsx + BaseModal.jsx, then Alert/ Chat/ Help/ UserSettings/
  hooks/          use*.jsx|ts — data fetching, sync, attachments, send
  apis/           one file per upstream call (chatCompletions, generateTitle, getModelsData, ...)
  db/             Dexie (IndexedDB) schema + all conversation persistence
  Redux/          reducers/ + store/ — UI and user settings only (see §4.1)
  config/         getModelDefaults.jsx + models/<model-id>.json capability files
  i18n/           en.js, de.js
  utils/          sendMessage, conversationUtils, attachments, appContext, tabChangeSync
back/service.mjs  POST /documents, GET /models, GET /user, POST /audio/speech, POST /chat/completions
secrets/          front.json + back.json (gitignored; *.sample committed)
```

## 3. Setup and commands

**Config is mandatory before anything runs.** Copy the samples first:

```bash
cp secrets/front.json.sample secrets/front.json
cp secrets/back.json.sample  secrets/back.json   # put a real apiKey in this one
```

`front/vite.config.js` calls `process.exit(1)` if `secrets/front.json` is missing or unparseable —
a front end that refuses to boot is almost always this.

### Native (preferred while iterating)

```bash
cd back  && npm i && npm run start   # :8081
cd front && npm i && npm run dev     # :8080
```

Both default `CONFIG_LOCATION` to `../secrets/<name>.json` and `path.resolve` it against the
**current working directory**, so run them from inside `front/` and `back/`, or set
`CONFIG_LOCATION` explicitly. The two services fail differently when the path is wrong: `front`
exits, while `back` only logs `Failed to read back.json. Using default values.` and keeps running
**with an empty `apiKey`** — so every upstream call comes back unauthorized. If requests are
rejected, check that log line first.

### Docker

```bash
docker compose build front back
docker compose up front back -d
docker compose restart front   # picks up config/source changes; rebuild if deps changed
```

Each Dockerfile sets `ENV CONFIG_LOCATION=/run/secrets/{front,back}`, fed by the docker secrets
declared in `docker-compose.yml`. Both services use `network_mode: host`, so ports are as
configured. `front/entrypoint.sh` greps `"mode"` out of `front.json` and runs `npm run dev` for
`dev` or `npm run prod` for `prod`, and exits on any other value.

### Checks

```bash
cd front && npm run build    # vite build — works, ~6s
```

**`npm run lint` does not currently run.** The script invokes `eslint`, but neither `eslint` nor the
plugins `.eslintrc.cjs` extends are in `front/devDependencies`, so a clean `npm i` gives
`sh: eslint: command not found`. (`.eslintrc.cjs` is also the pre-flat-config format.) Don't put
lint in your verification loop until that is fixed, and don't report it as passing.

**There is no test suite and no CI.** `front` has no test script, `back`'s `npm test` is `exit 1`,
and `.github/` contains only issue templates. So the loop is: build + exercise the change in a
browser. A passing build is not evidence that behaviour works.

`npm i` in `front/` may rewrite `package-lock.json` (the committed lock is stamped with an older
`version` than `package.json`). Check `git status` afterwards and keep unrelated lockfile churn out
of your commit.

## 4. Architecture invariants

These are the things that are not guessable from the file tree.

### 4.1 Two stores, strictly separated

| Store | Holds | Where |
| --- | --- | --- |
| **Dexie / IndexedDB** (`app-conversations-db`) | conversations, messages, content items, files, folders | `front/src/db/` |
| **Redux + redux-persist** (localStorage) | `interface_settings`, `user_settings`, `last_conversation`, `migration_data` | `front/src/Redux/` |

`version` is in the root reducer but is not in the persist whitelist.

Redux is persisted with a `version` + `migrations` map (`Redux/store/migrations.jsx`), and only a
four-action whitelist is mirrored across tabs via `redux-state-sync`: `SET_ADV`, `RESET_ALL`,
`MIGRATE`, `SET_COUNT`. Adding a persisted key means adding it to `whitelist` **and**
`getDefaultState()` in `Redux/store/store.jsx`.

### 4.2 The conversation data flow

`ChatPage.tsx` holds the whole hydrated conversation in one `localState` object and passes
`localState` / `setLocalState` down the tree. `useSyncConversation` reconciles that object with
IndexedDB. Writes go through `updateConversation(id, data)` in `db/index.ts`, which:

- replaces title + settings + the **entire** message list in a single Dexie transaction, and
- enforces optimistic concurrency: unless `force` is passed it compares `data.lastModified`
  against the row in the DB and **returns `-1` without writing** on mismatch. `-1` means another
  tab changed this conversation, and surfaces as `modals/Chat/ConversationConflict.jsx`.

So: thread the `lastModified` you read through to the write, and handle `-1`.

Data is normalised across `conversations → messages → content_items`, with `files_meta` /
`files_data` holding attachment bytes keyed by `fileId`; `hydrateConversation()` joins them back
into the nested shape the UI uses. Raw table access (`db.messages`, `db.content_items`, …) appears
**only** inside `front/src/db/` — everywhere else uses the functions it exports.

### 4.3 Dexie migrations

`db/index.ts` is at **version 4**. A new *indexed* field needs a new `this.version(n).stores({...})`
block plus an `.upgrade()` that backfills existing rows — this is how `folderId` (v3) and
`hasFirstPrompt` (v4) were added. A field that is only stored and never queried needs **no**
version bump; Dexie keeps unindexed properties on the row as-is. Never edit an existing version
block: users have live databases.

### 4.4 "folder" in code == "topic" in the UI

v1.0.0 renamed this feature for user-facing copy only. The `folders` table, `folderId`, and every
`*Folder*` function keep the old name. Don't rename them, and don't introduce "topic" identifiers
inside `db/`. UI strings and i18n keys say topic.

### 4.5 Config reaches the front end through vite.config.js

`secrets/front.json` is read **at Vite startup** and hand-mapped into `process.env.VITE_*`:
`VITE_BACKEND_ENDPOINT`, `VITE_MODELS_ENDPOINT`, `VITE_USERDATA_ENDPOINT`,
`VITE_DEFAULT_SETTINGS`, `VITE_TITLE_GENERATION_MODEL`, `VITE_MEMORY_GENERATION_MODEL`,
`VITE_PROPOSAL_GENERATION_MODEL`, `VITE_ANNOUNCEMENT`, `VITE_MODULE_*`. Consequences: **a new
config key requires editing `front/vite.config.js` too**, and a config change requires a dev-server
restart. Read values via `import.meta.env.VITE_*`; they arrive as strings, hence the
`=== "true"` comparisons.

Feature modules are gated this way — `VITE_MODULE_TOOLS`, `VITE_MODULE_FEEDBACK`,
`VITE_MODULE_CHOICES`, `VITE_MODULE_SPEECH` (JSON, with `model` and `voice`). A deployment can
switch these parts of the UI off, so new code in those areas must still behave with the flag off.

### 4.6 Model capabilities are data, not code

`front/src/config/models/<model-id>.json` is auto-globbed by `getModelDefaults.jsx` via
`import.meta.glob`, keyed on the filename. To give a model reasoning-effort support or other
per-model defaults, add or edit the JSON named exactly after the model id — no code change and no
registry to update.

### 4.7 Secrets

The API key is read only by `back/service.mjs` from `secrets/back.json`. `secrets/.gitignore`
ignores everything in that directory except itself, so real config files there are invisible to
git. Never move a key into front-end code or into a `.sample`.

### 4.8 The back service's responses can mislead you

Verified in `back/service.mjs`:

- **`/models` always returns HTTP 200**, even when the upstream rejects the request — the handler is
  `res.status(200).json(await response.json())`, so an upstream `{"message":"Unauthorized"}` arrives
  as a 200. Check the response body, never the status.
- **If `apiKey` is empty, `Authorization` falls back to the `inference-id` request header** rather
  than erroring — that is how the deployed setup passes per-user credentials through.
- **`/user` is a hard-coded placeholder** in this repo: it always returns the same `sample-user`
  object. Real user data comes from the gateway in a full deployment, so don't debug user/usage
  features against this response.

## 5. Conventions

- **Gradual TypeScript.** `.jsx` and `.tsx` coexist. `front/tsconfig.json` is `strict: false`,
  `checkJs: false`, `allowJs: true`, `noEmit: true` — Vite does the emitting, so `tsc` is not part
  of any script. Shared types live in `db/dbTypes.ts` and `types/`.
- **Styling** is Tailwind **v4** via `@tailwindcss/vite`, but the theme still comes from
  `tailwind.config.js`, pulled in by `@config "../tailwind.config.js"` in `src/index.css`. The
  palette (`primary`, `bg_dark`, `bg_chat`, …), the `mobile` / `middle` / `desktop` breakpoints and
  the custom shadows are defined there.
- **Dark mode** is the `dark` class, toggled on `document.body` by `App.jsx` from
  `interface_settings.dark_mode` (`darkMode: "class"` in the Tailwind config). Style with `dark:`
  variants; the source of truth is that Redux flag, not the OS preference.
- **i18n:** user-facing strings go through `react-i18next` `t()`. `i18n/en.js` and `i18n/de.js`
  currently have identical top-level key sets — add every new key to **both**.
- **Modals** are opened through the `useModal()` hook from `modals/ModalContext.jsx` and built on
  `BaseModal.jsx`; that is the pattern every existing modal in the repo follows.
- **Upstream calls** each get their own file in `apis/`. Components, hooks and modals import them
  directly — there is no enforced layer between them.
- CONTRIBUTING.md asks that files and folders follow the structure of the existing ones; keep
  components in the folder of the screen area they belong to.

## 6. Git workflow

- **Branch off `dev` and open PRs into `dev`.** `beta` is for changes that need testing before
  they go into `dev`; `main` carries releases. Work branches use flat, dash-separated names — e.g.
  `feature-forms`, `fix-toolNaming`, `markdown-fixes`, `tools-ui`, `lib-major-openai-v6`.
  (CONTRIBUTING.md documents the fork → feature branch → PR flow for outside contributors.)
- Releases are manual: bump `version` in `front/package.json` — it is shown in the footer by
  `VersionDisplay.jsx` and stamped into exported conversations by `conversationUtils.js` — and add a
  `## Version: vX.Y.Z (DD.MM.YYYY)` block with a `Highlights:` list at the top of `CHANGELOG.md`. `back/package.json` is versioned independently and is not
  bumped in lockstep.
- Never commit `secrets/*.json`, `node_modules/` or `dist/`.

## 7. Before you finish

- [ ] `npm run build` clean in `front/` (there is no working lint — see §3)
- [ ] new strings added to both `en.js` and `de.js`
- [ ] Dexie schema change → version bump + `.upgrade()` backfill, existing version blocks untouched
- [ ] new persisted Redux key → `whitelist` + `getDefaultState()` (+ a migration if the shape changed)
- [ ] new `front.json` key → mapped in `vite.config.js`
- [ ] touched a `VITE_MODULE_*` area → still correct with the module off
- [ ] conversation write → `lastModified` threaded through and `-1` handled
- [ ] behaviour exercised in a browser, not just compiled

## 8. Maintaining this file

This file is meant to grow. When you discover a constraint that cost you a debugging cycle — a
non-obvious invariant, a trap, a command that does not work the documented way — add it to the
matching section, briefly.

Two rules: **only write what you have verified in the code**, not what the structure suggests ought
to be true; and keep it to facts and rules — no task logs, no status updates, no changelog entries.
If something here turns out to be wrong, fix it rather than working around it.
