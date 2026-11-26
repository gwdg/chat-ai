# GAIA Chat AI — standalone branded deployment

Status: implementation in progress (branch `feature-gaia`).

This document records the approved scope, the architecture that carries it, and
the live todo list. Every item is checked off as it lands and verified.

## 1. Goal

Ship a **standalone GAIA-branded Chat AI deployment** (not an embedding into the
GAIA Svelte app) that keeps the Chat AI feature set for teaching staff while
giving students a narrowed, consent-gated assistant.

Approved scope (Phase 1 + items A–I):

| Item | Scope |
| --- | --- |
| Phase 1 | Brand folder (`branding/gaia`), deployment profile (`deployments/gaia`), assets, theme, links, footer |
| A | Brand `extends` support so `gaia-tutor` reuses the GAIA profile |
| B | GAIA fonts (Atkinson Hyperlegible Next) and shape/radius/depth tokens |
| C | Extra GAIA themes (`business2`, `green`) selectable where the light/dark toggle lives |
| D | Brand consent gate (terms + per-purpose consents), device-local, versioned |
| E | Dismissible brand chat notice, enabled by a new brand option |
| F | Gaia AI marker + watermark on assistant copy |
| G | PWA installability, brand-aware manifest |
| H | Student vs tutor narrowing (agents/workspaces for tutors only) |
| I | i18n (en/de), Meta-chat reporting, tests, docs |

Out of scope: layout parity with the GAIA Svelte UI (item J), internal
`/legal/*` routes (external links only), large rewrites.

## 2. Decisions

- **Deployment** `gaia` enables agents/workspaces/MCP for the deployment; the
  default brand `gaia` is the student profile and *narrows* `agent`, `agents`,
  `arcanas`, `workspaces`, `mcp_servers` and the external capabilities.
- **Tutor brand** `gaia-tutor` uses `extends: "gaia"` and overrides those
  restrictions back on. It cannot widen beyond the deployment, only beyond its
  parent brand. Selected by a claim rule (`GAIA-TUTOR` group) and testable with
  `?brand=gaia-tutor`.
- **Brand themes** are data (`brand.themes[]`) with hex colours, a colour scheme
  and optional shape. The effective dark mode is the custom theme's scheme when
  a brand theme is active, otherwise `interface_settings.dark_mode`.
- **Consent** is a two-step, mandatory, versioned dialog. Acceptance is stored
  locally per brand in `interface_settings.consent_acceptance`, never synced.
  Per-purpose answers are opt-in (default off), and can be changed later in
  Chat preferences → Advanced.
- **Model visibility (temporary).** Both GAIA brands set
  `external.external_models: true` for the local test stack, where the engine
  serves every model through the bridge and therefore labels all of them
  `(External)`. The student restriction must go back to `false` before a real
  deployment; the notice and terms still promise GWDG-operated models only.
- **Chat notice** stays brand HTML but gains `chatDisclaimerDismissible: true`;
  dismissal is session-scoped per brand, so a new visit shows it again.
- **AI marker**: brand asset rendered beside an assistant message; the copy
  watermark is appended only to assistant copy.
- **PWA**: a static Chat AI fallback manifest plus a runtime, brand-aware Blob
  manifest (icons from the brand folder). The service worker already exists in
  production. The install entry point is the footer button, shown only while the
  browser's one-shot `beforeinstallprompt` is available.
- **Language**: the footer picker stores `chatai.language` (`en`, `de` or
  `auto`) in localStorage, applies it before the first render and keeps
  `<html lang>` in step. `auto` means "follow the browser" and clears the
  detector's own cache so the next visit detects again.
- **Information pages** (`/about`, `/accessibility`) are brand-owned markdown
  (`brand.pages.<id>`), not global copy: GAIA's own copy describes quiz and
  tutoring features this deployment does not have. `/sitemap` is generated from
  the live data and offers only what the deployment shows.
- **Bug report** is configuration-gated, never a form without a sink: without
  `feedbackPath` there is no button. Either `back` `/feedback` forwards the
  multipart report to `feedbackEndpoint`, or the deployment forwards an
  app-visible path to the registry's `saia-feedback` tunnel, so the browser never
  holds the receiver's URL or token.

## 3. Architecture

### 3.1 Brand loading

`config/brands.js` loads every `branding/*/brand.json`, resolves assets (now
including `.woff2`), fonts, PWA icons and consent content, and merges each
profile over `chat-ai`.

`extends: "<id>"` resolves the parent profile first, then deep-merges the child
over it. A cycle or unknown parent falls back to the deployment defaults, so a
broken brand file never breaks boot.

### 3.2 CSS emission

`brandCss(brand, activeThemeId)` emits:

1. `@font-face` rules and the root/body font family from `brand.fonts`.
2. Shape tokens (`--radius-selector`, `--radius-field`, `--radius-box`,
   `--border`, `--depth`) from `brand.shape`.
3. The brand's light palette on `:root:not(.dark)` and dark palette on
   `:root.dark, body.dark`.
4. Sidebar surface rules as before.
5. One scoped block per custom theme,
   `:root[data-brand-theme="<id>"], body[data-brand-theme="<id>"]`, after the
   light/dark blocks so it wins (same specificity, later stylesheet).

`applyBrandDocument(brand, themeId)` sets `data-brand`, `data-brand-theme`,
the `<style id="brand-theme">` contents, the favicon and `theme-color`, and the
brand-aware PWA manifest.

### 3.3 Theme selection

`interface_settings.theme` is `"default"` or a brand theme id. It is
device-local (never synced). `App` computes the effective dark state, applies
the body/html classes and calls `applyBrandDocument`. `ThemeToggle` renders the
plain sun/moon button when the brand has no extra themes, otherwise a daisyUI
dropdown with Light, Dark and the brand themes.

### 3.4 Consent gate

`brand.consentGate` carries a version, localized title/intro, terms summary,
links and `purposes[]`. `components/Others/BrandConsentGate.jsx` renders an
isForced `BaseModal` in App:

1. Terms: summary, external legal links, mandatory checkbox.
2. Consents: one yes/no toggle per purpose (default off), Back and Save.

`acceptBrandConsent({ brandId, version, answers, acceptedAt })` persists the
record. A version change re-prompts. The gate is mounted inside `ModalProvider`
so it can also be reopened from Chat preferences.

### 3.5 Student / tutor narrowing

`deployments/gaia/index.json` enables the modules/features. Brand restrictions
narrow them through the existing `brandPolicy.js`; no new enforcement path is
introduced. The tutor brand overrides the parent's restrictions in its merged
profile.

### 3.6 PWA

`config/pwaManifest.js` builds a manifest from `brand.pwa` (name, short name,
colours, icons resolved from the brand folder) and swaps the `<link
rel="manifest">` href to a Blob URL. `index.html` and `public/site.webmanifest`
provide the plain Chat AI fallback (192/512 PNG generated from the ICO).

## 4. File map

| Path | Change |
| --- | --- |
| `front/src/config/brands.js` | `.woff2` glob, font/PWA resolution, `extends`, shape/themes CSS, theme-aware `applyBrandDocument` |
| `front/src/config/pwaManifest.js` | new: runtime brand manifest |
| `front/src/config/branding/gaia/*` | new brand: JSON, logos, icons, fonts, AI label |
| `front/src/config/branding/gaia-tutor/brand.json` | new: extends `gaia`, tutor restrictions |
| `front/src/config/deployments/gaia/index.json` | new deployment profile |
| `front/src/Redux/reducers/interfaceSettingsSlice.jsx` | `theme`, `consent_acceptance`, actions/selectors, device-only |
| `front/src/Redux/store/store.jsx` | defaults for the two new keys |
| `front/src/App.jsx` | effective dark mode, theme application, consent gate |
| `front/src/components/Header/ThemeToggle.jsx` | extra-theme dropdown |
| `front/src/components/Others/BrandConsentGate.jsx` | new two-step gate |
| `front/src/modals/UserSettings/BrandConsentSettings.jsx` | new: change consents later |
| `front/src/modals/UserSettings/UserSettingsModal.jsx` | render consent settings in Advanced |
| `front/src/components/Conversation/BrandChatWarning.jsx` | dismissible notice |
| `front/src/components/Conversation/MessageAssistant/MessageAssistant.jsx` | AI marker |
| `front/src/components/Conversation/MessageAssistant/CopyButton.jsx` | assistant watermark |
| `front/src/utils/metaTools.js` | report theme/consent |
| `front/index.html`, `front/public/site.webmanifest` | PWA fallback |
| `front/src/i18n/{en,de}.js` | new strings |
| `front/src/components/Footer/VersionDisplay.jsx` | brand name + home link |
| `front/src/modals/Help/WelcomeModal.jsx` | brand-aware welcome copy |
| `front/src/config/__tests__/brands.test.js` etc. | new coverage |
| `front/src/utils/language.js`, `i18n.jsx`, `App.jsx` | stored language choice, applied before first render; `<html lang>` follows |
| `front/src/components/Footer/LanguageSelector.jsx` | EN / DE / Automatic dropdown (was a two-flag toggle) |
| `front/src/utils/installPrompt.js`, `hooks/useInstallPrompt.ts`, `components/Footer/InstallAppButton.jsx` | PWA install entry point, shown only while the browser offers a prompt |
| `front/src/apis/feedback.js`, `modals/Feedback/BugReportModal.jsx` | bug report transport + dialog, gated by `feedbackPath` |
| `front/src/Pages/{BrandPage,SitemapPage}.jsx`, `components/Others/InfoLayout.jsx` | `/about`, `/accessibility`, `/sitemap` |
| `front/src/config/branding/gaia/{about,accessibility}.{en,de}.md` | brand-owned page copy |
| `back/service.mjs`, `front/vite.config.js`, `secrets/*.sample` | `/feedback` relay, `feedbackPath` / `feedbackEndpoint` / `feedbackToken` |

## 5. Todo list

- [x] Write this design document
- [x] Extend `brands.js` (woff2, fonts, PWA icons, `extends`, shape, themes, theme-aware document)
- [x] Add PWA manifest module
- [x] Add GAIA brand folder + assets
- [x] Add `gaia-tutor` brand
- [x] Add `deployments/gaia`
- [x] Redux: brand theme + consent acceptance
- [x] App: effective dark/theme + consent gate mount
- [x] ThemeToggle multi-theme selector
- [x] BrandConsentGate + BrandConsentSettings
- [x] Dismissible BrandChatWarning
- [x] AI marker + copy watermark (data + components; see limit below)
- [x] PWA fallback manifest + index.html + icons
- [x] Meta chat reporting
- [x] i18n en/de
- [x] Brand-aware footer version and welcome copy
- [x] Tests (brands, reducer, manifest, gate, naming)
- [x] Verify: targeted Vitest, `npm run build`, browser checks in light/dark/extra themes and with the gate
- [x] Update this document with verification results
- [x] Audit parity against the original GAIA app and record the gaps (§7)
- [x] Close the §7.2 gaps: language picker, PWA install prompt, About / Sitemap / Accessibility pages, bug report dialog + `/feedback` relay
- [x] Browser-verify the five additions, then full `npm test`, `npm run build` and `validate:guides`
- [x] Update this document with the second batch (§6, §7.2)

## 6. Verification results

Checkout: `feature-gaia`, 2026-11-23. Dev server:
`cd front && CONFIG_LOCATION=../secrets/front-gaia.json npm run dev`
(Vite served on `:8081` because `:8080` was occupied).

Automated:

- `npx vitest run src/config/__tests__ src/Redux/reducers/__tests__/reducers.test.js src/components/Others/__tests__/BrandConsentGate.test.jsx` — 114 passed.
- `npm test` — 256 files / 2010 tests passed.
- `npm run build` — clean.
- `npm run validate:guides` — 75 guides, 13 use cases.

Browser (headless Chrome via `puppeteer-core`, screenshots in
`/tmp/opencode/gaia-shots/`):

| Check | Result |
| --- | --- |
| Consent gate on first visit | Shows "Welcome to GAIA"; Continue disabled until the terms checkbox is ticked |
| Purposes | Four switches (`surveys`, `advanced_logging`, `survey_linking`, `data_linking`), all off by default |
| Acceptance | Stored in `persist:root → interface_settings.consent_acceptance.gaia` with version `2026-02` and a timestamp; gate closes; a reload keeps it closed |
| Light palette | `--color-primary: #132d6c`, light body background |
| Theme menu | Light / Dark / Business / Green |
| Business | `data-brand-theme="business"` on `html` and `body`, `dark` applied, primary `#1c4e80`, surface `#202020`, `--radius-box: 0.5rem` |
| Green | `data-brand-theme="green"`, light scheme, primary `#378100` |
| Back to Light | Attribute cleared, primary `#132d6c` |
| PWA manifest | Blob `link[rel=manifest]`, name "GAIA – Study assistant", theme `#132d6c`, 3 icons, absolute `start_url`/`scope`/`id` |
| Dismissible notice | Close button hides "GAIA is an AI system", `sessionStorage["chatai.brand-chat-notice.gaia"] === "1"`, stays hidden after a reload |
| Brand naming | Footer link reads "GAIA v2.0.1" and points at `https://gaia.uni-goettingen.de/`; the tour welcome modal greets "Welcome to GAIA 2.0.1"; a brand whose `name` is `{ en, de }` (MPG) renders its localized name (unit-tested) |
| Models | The selector lists every model the local engine offers — Anthropic 8, DeepSeek 3, GLM 3, Local 2, OpenAI 21, Qwen 6 — with the configured `bridge/qwen3-30b-a3b-instruct-2507` selected |
| AI marker | The `ai-label.svg` asset loads (150×150 SVG rendered at 18 px) beside the assistant answer; `brand.aiMarker.asset` now resolves to a build asset instead of a bare file name |
| Copy watermark | Copying the answer puts `hello\n\nGenerated with GAIA, an AI system. Check important information.` on the clipboard |
| Other brands | `?brand=chat-ai`, `mpg`, `ugoe`, `restricted`, `gaia`, `gaia-tutor` each load with no console/page error; title, footer version, logo alt, palette, manifest (static `/site.webmanifest` vs GAIA Blob), disclaimer and notice match the brand |
| Tutor notice | `gaia-tutor` now inherits GAIA's "GAIA is an AI system" notice; the loader no longer erases an omitted `chatDisclaimer`/`disclaimer`/`systemPrompt` to `null` before the `extends` merge |
| Brand logos | Every brand's images resolve (`naturalWidth > 0`) and the sidebar/empty-state alt is the brand name instead of a hard-coded "Chat AI Logo" |

External models are temporarily allowed in both GAIA brands so the local test
stack's bridge models are selectable (see §2). With that setting, the yellow
"Your messages may be processed outside of GWDG" warning appears as designed.

Second batch (the §7.2 gap closure), same checkout and dev server:

Automated:

- `npx vitest run src/utils/__tests__/language.test.js src/components/Footer/__tests__ src/modals/Feedback/__tests__/BugReportModal.test.jsx src/Pages/__tests__/BrandPages.test.jsx src/config/__tests__/brands.test.js` — 7 files / 53 passed.
- `npm test` — 261 files / 2030 tests passed (both batches).
- `npm run build` — clean.
- `npm run validate:guides` — 78 guides, 13 use cases.

Browser:

| Check | Result |
| --- | --- |
| Language picker | English → German renames the footer to `Impressum`, `Datenschutz`, `Nutzungsbedingungen`, `Doku`, `Über uns`, `Sitemap`, `Barrierefreiheit`, the picker reads `DE`, `localStorage["chatai.language"] === "de"` and `document.documentElement.lang === "de"`; a reload starts in German. "Automatic" stores `auto`, clears `i18nextLng` and reads `AUTO` |
| About page | `/about` renders the brand markdown (five `h2`s, "What GAIA is not" included) under the GAIA mark; "Back to chat" returns to the open chat |
| Sitemap | `/sitemap` lists New Chat, the Meta chat, About and Accessibility; the empty topic, workspace and agent sections are dropped |
| Accessibility statement | `/accessibility` renders the statement from `accessibility.en.md` |
| Footer routes | `/about`, `/sitemap` and `/accessibility` are in-app routes; the legal links and the brand `help` asset still open in a new tab |
| Bug report | The footer bug button appears only with `feedbackPath` set; the dialog lists Bug / Feedback / Accessibility / Other and the diagnostics it will send; a report with type "accessibility" and a description arrives at `back` `/feedback` and at the test receiver as multipart (`payload` with `type`, `message`, `route`, `user_agent`, `app_version`); the dialog then shows "Thank you — the report was sent." |
| PWA install button | Not reproducible in headless Chrome: `beforeinstallprompt` never fires, so the button stays hidden. Covered by `InstallAppButton.test.jsx` with a synthetic event (hidden → shown → one use → hidden on `appinstalled`) |

## 7. Parity audit: what the original GAIA app has that this deployment does not

Checked 2026-11-23 on `feature-gaia` against `gaia/` (the original SvelteKit app
+ FastAPI backend in this checkout): `gaia/frontend/src/routes`,
`gaia/frontend/src/lib`, `gaia/backend/src/api`, `gaia/db_template/pb_migrations`
and `gaia/logdata`. Everything below was read in that code, not taken from the
GAIA documentation.

The two systems solve different problems. GAIA is a **course-scoped, mode-aware
teaching platform** whose FastAPI backend owns the conversation history, the
system prompt, RAG, quiz and tutoring state. This deployment is a **standalone
generic chat client** whose conversation state lives in the browser (§4.2 of
`AGENTS.md`). So a large part of the gap is not "missing UI" but "missing
service". The gap list is therefore split by what it takes to close it.

### 7.1 Already covered

Chat UX (streaming, abort, retry, edit, fork, undo), one
topic per conversation set, markdown with KaTeX, Mermaid, Typst, LaTeX and TikZ,
attachments with server or in-browser document conversion, AI marker and copy
watermark, brand consent gate, dismissible brand notice, brand themes, PWA
manifest and service worker, per-message thumbs up/down feedback, i18n (en/de),
Meta chat, and the whole agent/workspace/MCP/Arcana/memory/persona/tutorial/
E2EE/sync/backup/speech stack that GAIA does not have at all (§7.5).

### 7.2 Gaps that need no GAIA backend (closed on this branch)

These are frontend work inside this repository. Nothing here implies a student
feature that the deployment cannot serve.

| Feature | Original GAIA | Status on this branch | Size |
| --- | --- | --- | --- |
| **PWA install prompt** | `lib/components/PWAInstall.svelte`: captures `beforeinstallprompt`, hides when `display-mode: standalone` or iOS `navigator.standalone`, shows an install button, handles `appinstalled` | **Done.** `utils/installPrompt.js` stashes the once-only event in module state, `hooks/useInstallPrompt.ts` subscribes, and `Footer/InstallAppButton.jsx` renders the button only while a prompt exists; it disappears after one use and on `appinstalled`, so a browser without the API shows no dead control | S |
| **Language picker** | `lib/components/LanguagePicker.svelte`, mounted in the navbar, home, login and consent pages | **Done.** `Footer/LanguageSelector.jsx` offers English, German and Automatic. The choice lives in `localStorage["chatai.language"]` (`utils/language.js`), `i18n.jsx` applies it before the first render, Automatic clears `i18nextLng` so detection runs again, and `App.jsx` keeps `<html lang>` in step | S |
| **About page** | `routes/(app)/about/+page.svelte` + `about.{en,de}.md`, rendered with `marked` and sanitised by DOMPurify, with an `embedded` prop | **Done.** `/about` (`Pages/BrandPage.jsx`) renders the brand's own markdown through the app's safe renderer; GAIA ships `about.{en,de}.md` | S |
| **Sitemap page** | `routes/(app)/sitemap/+page.svelte`: general links, legal links, and the accessible courses with their modules | **Done.** `/sitemap` (`Pages/SitemapPage.jsx`) lists the live chats/topics/workspaces/agents plus About and Accessibility; empty sections and switched-off modules are omitted, and there are no courses to list | S |
| **Accessibility statement** | `routes/(app)/accessibility/+page.svelte`: a structured statement with an easy-language variant, contacts, mediation office and a TOC | **Done.** `/accessibility` uses the same brand-owned copy mechanism (`accessibility.{en,de}.md`), and the statement names the GAIA contacts, the mediation office and the authoritative external page | S (content, not code) |
| **Bug report dialog** | `lib/components/BugReportDialog.svelte` + `lib/services/feedback.ts`: type (bug / feedback / accessibility / other), description, up to 3 screenshots ≤ 5 MB, route + user-agent + app-version context, multipart `POST /api/v1/feedback`; the backend stores it in PocketBase and notifies a Matrix room | **Done.** `modals/Feedback/BugReportModal.jsx` + `apis/feedback.js` send the same multipart shape. `back` `/feedback` forwards it (with the caller's identity headers and an optional `feedbackToken`) to `feedbackEndpoint` from `back.json`, so the browser never learns the receiver. Without `feedbackPath` the footer shows no button; a 501 offers "Copy report" | M |

The two information pages are **brand-owned copy**, not global strings:
`brand.pages.<id>` names markdown files in the brand folder
(`config/branding/<brand>/about.{en,de}.md`). GAIA's About page describes quiz,
tutoring and knowledge tracing, which this deployment deliberately does not
have, so shipping that text as global copy would be false. A brand that ships no
copy still gets a usable page: it links its own `links.<id>` target instead.

The feedback endpoint GAIA itself uses is `POST /api/v1/feedback` with exactly
this `payload` + `screenshots` body, so `feedbackEndpoint` can point straight at
that service; the GAIA backend stores the report in PocketBase and notifies its
Matrix room as before. The frontend half is the only part that was missing.


Two more that only make sense with a producer:

| Feature | Original GAIA | Why it is not just UI |
| --- | --- | --- |
| **Citation rendering** | `lib/utils/sources.ts` parses `[^1]` / `[^2, ^3]` markers, `MarkdownContent.svelte` renders the footnote list with page numbers, `api/rag.py#get_cited_image` serves cited page images | The renderer is small, but without a RAG payload (see §7.3) there is nothing to render |
| **Server-owned conversation history** | `conversations` / `messages` / `chat_context` in PocketBase, scoped by mode, so a course chat opens on any device and the backend can read it | We store in Dexie and offer opt-in E2EE sync instead (§4.32). Replacing that with a server-side store is an architecture change, not a feature |

`Tiptap` (`lib/components/Tiptap/`) is **not** a chat-composer gap: GAIA's chat
input is a plain `<textarea>` (`lib/components/chat/ChatInput.svelte`), the same
as our `PromptTextArea`. Tiptap is the authoring editor for quiz questions and
worked examples, so it belongs to §7.3.

### 7.3 Gaps that need a GAIA-style backend

Everything in this table depends on PocketBase collections, FastAPI routes,
`saia-rag-cli` and the `logdata` pipeline. Implementing them here would mean
building the GAIA backend, not extending Chat AI.

| Area | What GAIA has |
| --- | --- |
| **Identity and tenancy** | PocketBase auth with OIDC (AcademicCloud) and GitLab providers, `/join`, `/account` (title, studyProgram, nickname, aboutMe, instructions, language), roles `student` / `lecturer` / `admin`, `course_access` and `course_owners` collections, `/home` with one menu per module (Learn / Practice / Worked examples) listing the courses where that module is enabled |
| **Stud.IP / LTI 1.1** | `/course-admin/access`, LTI launch and role mapping |
| **Course modules** | `courses.modules` (lectures / exercises / tutoring), `ModeSwitcher`, per-module routes `[course]/chat`, `[course]/quiz`, `[course]/tutoring` |
| **Quiz mode** | Question bank (`quiz_question`), topic and skill links, difficulty and cooldown, draw / next / dismiss, attempts and evaluation, hints and misconceptions, mastery aggregate, checkpoints, Excel import (`exceljs`, `lib/services/quizImport.ts`), admin CRUD and import preview |
| **Tutoring mode** | `tutoring_exercises`, `tutoring_sessions`, outline, steps, history, resume / restart, read-only archived sessions, print and download; worked examples with `lib/components/chat/interactive/` (MultipleChoice, TextInput, Step, Confirmation, Infobox) |
| **Skills and topics** | `skills`, `skill_prerequisites`, `topics`, prerequisite and dependent graphs, per-skill questions, AI-assisted skill import (`skill-ai.ts`, `skillImport.ts`) |
| **RAG / course material** | `rag_documents`, `rag_document_versions`, `rag_ingestion_jobs`, `rag_document_images`; upload, ingestion jobs, versions, retry schedule, embeddings and vector store, the `search_material` tool, citations with page numbers and cited images |
| **Learner analytics** | BKT knowledge tracing (`backend/src/knowledge_tracing/bkt_engine.py`, per-skill mastery), `question_attempts`, `knowledge_tracing` collection, course aggregate endpoint, the `logdata` service (FastAPI + PostgreSQL/TimescaleDB, `events.md` catalog: usage, learning, learner_model, course) |
| **Server-enforced consents** | `users.consents` in PocketBase (`terms`, `usage_analysis`, `surveys`, `survey_linking`, `advanced_logging`, `data_linking`) with a `consent_events` audit collection, a `policy_version` stamped by a PocketBase hook, email consent (`email_consents`) and linking codes that join survey data to usage data — enforced on the server, so they follow the user across devices |
| **Course administration** | `/course-admin/{course-data,documents,quiz,skills,worked-examples,access}` and the admin-only system-prompt editor (`manage/system-prompts/{system,chat,quiz,tutoring}`) |
| **Feedback delivery** | `/api/v1/feedback` → PocketBase `feedback` collection + `clients/matrix_client.py` room notification |

### 7.4 Out of scope by decision

- **Embedding Chat AI inside GAIA** (`@chat-ai/core`, `src/embedded/ChatPanel`,
  `src/adapters/gaia.ts`, the `ChatAiIsland` in `gaia/frontend/src/lib/components/chat-ai/`).
  That is the `chat-ai-modularization` branch vendored as `gaia/chat-ai` at
  v1.0.2; this checkout is v2.0.1 and has no `front/src/core`, `embedded` or
  `adapters`. It is a different project (one chat engine, two hosts), not a
  feature of this deployment.
- **Layout parity with the Svelte UI** (§1, item J).
- **Internal `/legal/*` routes**: the GAIA brand links the university pages
  instead (§1).

### 7.5 What this deployment has that GAIA does not

Agents (in-browser Pi runtime, direct OpenCode servers and the SAIA agent
service with the workspace bridge), workspaces with live providers (device,
chats, Arcanas, saia-fs, agent filesystem, MCP), MCP servers, Arcana Tools,
memories and memory groups, personas, tutorials and use cases, E2EE-sealed
model requests, encrypted cross-device sync and encrypted backup, speech input
and output, Typst / LaTeX / TikZ / Mermaid rendering, document conversion,
image generation and editing, the Meta chat over local data, topics, the pinned
section, the brand system (consent gate, themes, notice, AI marker, PWA manifest,
brand-owned information pages, language picker, install prompt, bug report) and
78 feature guides.

### 7.6 Recommendation

The §7.2 items are implemented on this branch. The only configuration the bug
report needs is a sink: `feedbackEndpoint` in `back.json` (GAIA's
`/api/v1/feedback` accepts the body unchanged) and `feedbackPath` in
`front.json` pointing at `back`'s `/feedback`, which also hides the entry point
again when it is unset. Treat everything in §7.3 as the GAIA backend roadmap,
not as Chat AI work. Citations and server-side history wait for the RAG service
and a decision about where conversation history lives.
