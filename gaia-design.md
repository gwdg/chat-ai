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
  production.

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
