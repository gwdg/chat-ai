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

`npm i` can rewrite `package-lock.json`. Check `git status` afterwards and keep unrelated lockfile
churn out of your commit.

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

### 4.9 Typst rendering is client-side, from fenced code blocks

**Entry point.** `rendererComponents.code` in `MarkdownRenderer.jsx` handles fenced blocks:
` ```mermaid ` goes to `MermaidDiagram.jsx`, ` ```latex ` / ` ```tex ` goes to `LatexBlock.jsx`
(§4.10), ` ```typst ` / ` ```typ ` goes to `TypstBlock.jsx` with rendering enabled by default, and
every other language also goes to `TypstBlock.jsx` with `defaultRender={false}`. Inline code is
returned directly and never rendered.

**Pipeline.** `TypstBlock.jsx` lazily imports `@myriaddreamin/typst.ts` on the first render. Its
compiler and renderer WASM files are imported with Vite's `?url` (`TypstBlock.jsx:6-7`), so Vite
emits them as app assets; nothing is fetched from a Typst server. The first render calls
`$typst.svg({ mainContent })`, which runs the Typst compiler and renderer WASM in the browser and
returns an SVG string. That SVG is sanitised, cached by source text (max 50 entries), and inserted
into a shadow root attached to the block's container. The shadow root is required because Typst's
SVG carries its own `<style>` with global selectors such as `svg { fill: none; }`; in the light DOM
that silently strips the fill from unrelated app icons. After mounting, full-page page-background
shapes (Typst emits one for `#set page(fill: ...)`) are ignored for measurement, then the viewBox is
rewritten to the rendered content's `getBBox()` plus 6 pt padding, so the unused page canvas is
cropped away. The back service and API endpoint are not involved.

**Scheduling.** Rendering is debounced by 400 ms, so streaming code blocks are not recompiled on
every keystroke. `$typst` is a single shared, stateful instance, so `TypstBlock` serialises all
compilations through a module-level promise queue; a cancelled render is ignored when it finishes.
Compile errors fall back to the raw source.

**Per-block UI.** ` ```typst ` / ` ```typ ` blocks start rendered or as code according to the
`user_settings.render_typst` flag (Chat preferences → Rendering). All other code blocks start as
code. Every block keeps a "Render as Typst" / "Show code" toggle regardless of the preference; the
preference only selects the default view. The selector defaults the flag to `true` so existing
persisted settings without the key keep rendering.

**Resources and security.** The WASM modules are served from the app's own build output. typst.ts
fetches its default text fonts from jsDelivr at runtime unless `assetUrlPrefix`/`loadFonts` is
configured, so rendering needs network access to that CDN. Model output is untrusted: the SVG is
sanitised with DOMPurify's SVG profile plus `ADD_TAGS: ["use"]` (the profile otherwise drops
`<use>`, which Typst uses to reuse glyphs), and `data_selection.js` is disabled.

### 4.10 LaTeX document blocks render client-side with faster-latex

`rendererComponents.code` routes ` ```latex ` / ` ```tex ` fences to `LatexBlock.jsx`; other code
blocks still go to `TypstBlock.jsx` with `defaultRender={false}`. `LatexBlock` lazily imports the
`faster-latex/web` build, initializes its WASM (emitted as a Vite asset), and calls
`render(source, { fullDocument: false })`. The WASM is imported via the `faster-latex-wasm` alias
in `vite.config.js`, which maps to the package's `web/faster_latex_bg.wasm`; this is required
because the package's own `new URL(..., import.meta.url)` path works in the production build but
not in the dev server. faster-latex is a Rust→WASM LaTeX subset that emits HTML
with MathML; it is **not** a full TeX distribution — `\usepackage`, TikZ and other primitives are
unsupported, and unsupported constructs produce warnings and visible fallbacks rather than failing.
The HTML is sanitised with DOMPurify's `html` + `mathMl` profiles, then inserted into a shadow root
with the shipped article CSS plus a small override, so the stylesheet cannot leak into the app.
Rendering is debounced by 400 ms and cached by source text. `user_settings.render_latex` only
selects the default view; every block keeps a "Render as LaTeX" / "Show code" toggle. No back
service or API endpoint is involved.

### 4.11 TikZ inside LaTeX blocks renders with self-hosted TikZJax

TikZ is **not** a separate code-block type. `LatexBlock` preprocesses every ` ```latex ` / ` ```tex `
block: `tikzRenderer.js` extracts `tikzpicture`/`tikzcd` environments, strips
`\usetikzlibrary` and known `\usepackage` declarations from the text, and replaces each environment
with a `TIKZPLACEHOLDER<n>END` token. The extracted snippets are rendered off-screen through
TikZJax (a hidden `<pre class="language-tikz">`) to SVG strings, while the cleaned source is
rendered with faster-latex. The tokens are then replaced with
`<span class="latex-tikz">…SVG…</span>`, and the combined HTML is sanitized with DOMPurify's
`html` + `svg` + `mathMl` profiles (plus `ADD_TAGS: ["use"]`).

TikZJax's dist and its ~7.7 MB of TeX/font assets are copied from `@rod2ik/tikzjax` into
`public/tikzjax` by `scripts/copy-tikzjax.mjs`, which runs as `predev` / `prebuild` / `preprod`;
that directory is gitignored. `vite.config.js` serves `/tikzjax/*.gz` with
`Content-Encoding: identity`: otherwise Vite marks the `.gz` files as gzip-encoded, the browser
transparently decompresses them, and TikZJax's own gunzip fails with "incorrect header check".
`tikzRenderer.js` sets `workerMode: "direct"` and disables `workerPool`; the pool path wraps the
worker in a blob and loads it with `importScripts`, which can fail under some deployments/CSPs.
Only packages in the loader's known set are forwarded; TikZ libraries from
`\usetikzlibrary` and preamble commands such as `\tikzset` are forwarded via the pre's data
attributes. `user_settings.render_latex` controls the LaTeX block's default view. The TikZJax
package is GPL-3.0+.

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
- **Never enable `rehype-raw` without a sanitizer.** Model output is untrusted: it reaches the DOM
  verbatim, and so does any imported or shared conversation. `rehype-raw` in `ThinkingBlock.jsx`
  once turned HTML the model drafted while reasoning into live markup — `<iframe>` tags fetched
  real URLs (tripping Chrome's local-network prompt) and an injected `<style>` restyled the whole
  page. `SafeMarkdown` is safe only because it leaves `rehype-raw` off, so react-markdown drops
  raw HTML nodes. To *show* raw HTML instead of dropping it, convert mdast `html` nodes to `text`
  (`remarkHtmlAsText` in `ThinkingBlock.jsx`) — that leaves code fences alone, since fenced and
  inline code are their own node types.
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
