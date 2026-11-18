# Deployment profiles and brands

Status: **first slice implemented; the rest of this document is the target
design.** The shipped part is the two-tier split (build-time deployment profile +
runtime brand), the Chat AI default brand, a **UGOE** sub-brand for members of the
University of Göttingen, and a `minimal` deployment. Section 15 lists exactly what
exists and where it differs from the text above; treat any other section as
planned work, not as a description of the current code.

This document describes how the web interface should support several
installations with one codebase: three heavyweight deployments (**Chat AI**,
**GAIA**, **OHB**), each of which may show different brands to different user
groups.

It builds on the existing configuration path (`secrets/front.json` → `vite.config.js`
→ `import.meta.env.VITE_*`) and does not replace it.

## 1. Goals and non-goals

Goals:

- One repository and one component tree for all deployments; a fix or a security
  patch is written once.
- A deployment can change which features exist, where UI blocks sit, which
  models are offered, and its legal copy.
- A deployment can serve several institutions with their own name, logo,
  colours, links and copy, resolved per user at runtime.
- Both tiers are ordinary, reviewable configuration with build-time validation.

Non-goals:

- A fork or branch per deployment.
- A brand changing features, routes or layout.
- A runtime theme editor, or arbitrary CSS/HTML injected from a server.
- Per-deployment source files for individual components.

## 2. The two tiers

| Tier | Resolved | Decides | May not change |
| --- | --- | --- | --- |
| **Deployment profile** | Build time | Backend, models, features, layout, default brand, brand claim rules, legal copy | — |
| **Brand profile** | Runtime, per user | Name, logo, favicon, colours, links, footer, copy | Features, layout, routes, model catalogue |

```
secrets/front-chat-ai.json ─┐
secrets/front-gaia.json    ─┼─► vite build ─► dist/chat-ai, dist/gaia, dist/ohb
secrets/front-ohb.json     ─┘        │
                                     └─ brand chosen per user at runtime
```

Two invariants are enforced mechanically (build error, not review comment):

1. **A brand cannot change features or layout.** If an institution needs a
   different app, it needs a deployment.
2. **The server chooses *which* brand, never *what* the brand is.** A gateway may
   return a brand id; it may not return logos, URLs or CSS. Brand definitions stay
   in the build, so a misconfigured or compromised gateway cannot inject markup.

Consequence: GAIA with twenty institutions is one build with twenty brand
profiles. Chat AI is one deployment with a single brand, using the same
machinery.

## 3. File layout

Configuration is split by nature: operations that may contain secrets stay
gitignored; product configuration is committed, reviewed and tested.

```
secrets/
  front-chat-ai.json          ops per deployment (gitignored)
  front-gaia.json
  front-ohb.json
  front.base.json             shared ops defaults, extended by the above (optional)

front/src/config/branding/
  chatai/
    brand.json               name, links, footer, theme, asset file names
    logo.svg
    logo-small.ico
    logo.png
    favicon.ico
  ugoe/
    brand.json
    logo.svg
    logo-dark.svg
    mark.svg
    mark-dark.svg
    favicon.ico

front/src/config/deployments/
  chat-ai/
    index.json                modules, features, layout, default brand, claim rules
  gaia/
    index.json
  ohb/
    index.json

front/scripts/resolve-config.mjs   extends, merge, validate; used by vite.config.js
front/src/config/deployment.js     build-time accessors (features, layout, rules)
front/src/config/brands.js         brand loader, lookup + claim rules
front/src/config/BrandProvider.jsx brand context, document/title/favicon updates
```

A brand is one folder under `config/branding/`: `brand.json` plus the images it
names. `brand.json` holds everything about the brand — name, logo variant, links
and **footer**, theme and surface colours, aliases — so nothing about a brand is
spread over the deployment profile or a defaults module. The loader resolves the
file names to hashed build URLs (`?url&no-inline`), so brands are part of the
bundle and the service worker caches them like any other asset. The only
exception is `front/public/chat-ai.ico`, which `index.html` points at before the
app boots; the brand's own `favicon` replaces it on mount.

## 4. Deployment profile

### 4.1 Ops file (`secrets/front-<id>.json`)

Holds what is specific to one installation and may be secret. It reuses the
existing keys and mapping in `front/vite.config.js`.

```jsonc
{
  "deployment": "gaia",
  "mode": "build",
  "port": 8082,
  "backendPath": "https://gaia.example.org/v1",
  "modelsPath": "https://gaia.example.org/v1/models",
  "userDataPath": "https://gaia.example.org/v1/user",
  "apiKey": "",
  "default": { "model": { "id": "…" } },
  "extends": "./front.base.json"
}
```

`deployment` selects the product-config directory. `extends` is resolved by
`resolve-config.mjs`: deep merge, arrays replace, cycles rejected, unknown keys
rejected. `mode`, `port` and `apiKey` keep their current meaning.

### 4.2 Product file (`front/src/config/deployments/<id>/index.json`)

```jsonc
{
  "schemaVersion": 1,

  "modules": {
    "tools": true,
    "feedback": false,
    "choices": true,
    "agent": true,
    "agents": true,
    "arcanas": true
  },

  "features": {
    "meta_chat": true,
    "workspaces": true,
    "mcp_servers": true,
    "e2ee": true,
    "tutorials": true,
    "import_git": false
  },

  "models": {
    "allow": [],
    "deny": []
  },

  "layout": {
    "variant": "classic",
    "sidebar": { "sections": ["pinned", "chats", "workspaces", "agents", "mcp"] },
    "header": { "items": ["menu", "brand", "model", "warning"] },
    "prompt": { "items": ["attachments", "workspace", "tools", "model", "send"] },
    "footer": { "visible": true }
  },

  "brands": {
    "default": "chat-ai",
    "trustedField": "brand",
    "rules": [
      { "claim": "oidc_claim_o", "equals": "University X", "brand": "uni-x" },
      { "claim": "email", "suffix": "@uni-c.example", "brand": "uni-c" }
    ]
  }
}
```

`features` is separate from `modules` on purpose: `modules` are the coarse product
areas that already gate routes and code paths, `features` are the finer switches
inside an area (`web_search` inside tools, `import_git` inside workspaces).
Existing defaults are preserved per key; see section 9.

The deployment names the default brand and the claim rules; what a brand looks
like lives in its own folder, `front/src/config/branding/<folder>/brand.json`
(section 5).

### 4.3 Brand resolution

Precedence, first hit wins (as implemented, see section 15):

1. A `?brand=<id>` query parameter, kept for the visit in `sessionStorage` so
   client-side navigation does not drop it, and removed before the logout
   redirect. Testing override only.
2. `userData.brand` / the deployment's `trustedField`, if it names a known profile.
3. The first matching rule in `brands.rules`.
4. `brands.default`.

Rules support `equals`, `contains`, `suffix` and `oneOf` on one claim or a list of
claims. `contains` is what matches a group list such as
`oidc_claim_groups: ["UGOE:members"]`. No regular expressions: they are
unnecessary here and easy to get wrong. An unknown brand id never breaks the page;
it falls back to the default.

Brands are merged over Chat AI when the profile is read, and the deployment table
only names the default brand and the claim rules, so runtime resolution is a
lookup. A gateway cannot add a brand without a rebuild; that is the price of the
security invariant, and a logo change is cheap to ship.

## 5. Brand profile

The file lives at `front/src/config/branding/<folder>/brand.json`; `id` is the
canonical brand id (defaulting to the folder name) and the image values are file
names next to that JSON. A profile may be partial: anything it omits is merged
over the Chat AI brand, so a sub-brand usually only names its colours and its
own links.

```jsonc
{
  "id": "uni-x",
  "aliases": ["university x", "uni-x.example"],
  "name": "AI X",
  "shortName": "AI X",
  "homeUrl": "https://ai.uni-x.example/",
  "locale": "de",
  "toolboxName": "AI X Tools",

  "logo": { "alt": "AI X", "headerVariant": "mark" },  // files come from "assets"
  "assets": {
    "full": "logo.svg",
    "fullDark": "logo-dark.svg",
    "mark": "mark.svg",
    "favicon": "favicon.ico"
  },
  "theme": {
    "light": {
      "primary": "#123f7a", "primaryContent": "#ffffff",
      "accent": "#0a7d55", "accentContent": "#ffffff",
      "base100": "#ffffff", "base200": "#f6f7f9", "base300": "#e5e7eb",
      "baseContent": "#1a1a1a", "info": "#0a7d55", "chat": "#eef4fb"
    },
    "dark": {
      "primary": "#6aa9e9", "primaryContent": "#0b1220",
      "accent": "#4ade80", "accentContent": "#052e16",
      "base100": "#22262b", "base200": "#171a1e", "base300": "#343a41",
      "baseContent": "#f5f5f5", "info": "#6aa9e9", "chat": "#2b2b2b"
    }
  },

  // Per-surface overrides. The sidebar is the only surface today; it repaints
  // the daisyUI variables inside `.brand-sidebar`, so every utility already in
  // that subtree (bg-base-100, hover:bg-base-200, text-accent, …) follows.
  "surfaces": {
    "sidebar": {
      "light": {
        "background": "#d7e7f1", "hover": "#c5dbea", "border": "#b2cddf",
        "content": "#10233a", "accent": "#123f7a"
      },
      "dark": {
        "background": "#1b2b38", "hover": "#243748", "border": "#31505f",
        "content": "#e6f0f6", "accent": "#8ab8cf"
      }
    }
  },

  "links": {
    "imprint": "https://uni-x.example/imprint",
    "privacy": "https://uni-x.example/privacy",
    "terms":   "https://uni-x.example/terms",
    "docs":    "https://uni-x.example/docs",
    "models":  "https://uni-x.example/models",
    "support": "mailto:support@uni-x.example"
  },

  "footer": {
    "isoCertified": false,
    "links": {
      "privacy": {
        "label": { "en": "Data Privacy for University X", "de": "Datenschutz für Universität X" },
        "url": "https://uni-x.example/privacy"
      },
      "support": { "label": "Support", "url": "mailto:support@uni-x.example" }
    }
  },

  "copy": {
    "data_security_notice": "…",
    "data_security_notice_e2ee": "…",
    "external_model_notice": "…"
  },

  "announcement": "Plain-text announcement for this brand."
}
```

Rules:

- Every `copy` value renders as **text**, never HTML. The deployment announcement
  keeps its current HTML behaviour; a brand announcement is plain text and must
  not reuse `dangerouslySetInnerHTML`.
- Colours are validated as `#rgb`, `#rrggbb` or `#rrggbbaa`. Links must be
  `https:` or same-origin. Brand ids match `[a-z0-9-]+`. Unknown keys fail the
  build.
- `theme` accepts the daisyUI palette tokens (`primary`, `primaryContent`,
  `secondary`, `accent`, `neutral`, `base100`, `base200`, `base300`,
  `baseContent`, `info`, `success`, `warning`, `error`, the matching `*Content`
  pairs and `chat`). A brand may override any subset; everything it omits keeps
  the Chat AI value.
- `surfaces` repaints a named subtree rather than the whole page. `sidebar` maps
  `background` → `--color-base-100`, `hover` → `--color-base-200`, `border` →
  `--color-base-300`, `content` → `--color-base-content` and `accent` →
  `--color-accent` inside `.brand-sidebar`, which `SidebarRail`, `SidebarPanel`
  and `SidebarDrawer` carry. Existing utilities in that subtree (`bg-base-100`,
  `hover:bg-base-200`, `text-accent`, …) then follow without per-component
  classes. Light and dark are separate blocks, so a brand with no dark surface
  values keeps the values from `theme.dark`.
- `footer.links` is keyed by link id and merged, so a brand changes one entry
  without repeating the list. An entry may set `label` (string or `{en, de}`),
  `url` (defaults to `links.<id>`) and `visible: false`; a new id appends a link.
  `footer.isoCertified: false` removes the ISO 27001 claim in brands that do not
  hold that certificate.
- A brand profile may not contain `modules`, `features`, `layout` or model
  settings; their presence is a build error (invariant 1).
- A brand cannot suppress `WarningExternalModel` or the data-security notice.

## 6. Runtime behaviour

- `BrandProvider` (context, like `FilePreviewContext`) starts with the
  deployment's default brand, resolves the user's brand when `/user` answers, and
  exposes `{ brand, brandId }` through `useBrand()`.
- The resolved brand is **not** persisted in Redux or `localStorage`. It is
  derived from the session user; persisting it would leak one user's branding into
  the next session on a shared machine, and would add a persisted key plus
  migration surface. A `sessionStorage` entry may cache the last id for the first
  paint and is cleared on logout, before the Keycloak redirect.
- **CSS:** a brand's colours are written at runtime into a single
  `<style id="brand-theme">` element in `<head>` (built once per brand change, not
  one block per brand in the bundle):

  ```css
  :root { --color-primary: #123f7a; --color-base-200: #f6f7f9; --chat: #eef4fb; }
  body.dark { --color-primary: #6aa9e9; --color-base-100: #22262b; --chat: #2b2b2b; }
  body:not(.dark) .brand-sidebar { --color-base-100: #d7e7f1; --color-accent: #123f7a; }
  body.dark .brand-sidebar { --color-base-100: #1b2b38; --color-accent: #8ab8cf; }
  ```

  React sets `document.documentElement.dataset.brand` as well. This survives the
  dark-mode specificity trap: the `.dark` block in `index.css` re-declares `--chat`
  and the `base-*` colours on `<body>`, so a brand's dark values must be emitted
  against `body.dark`, not only against the root element. Only values that parse as
  hex colours are emitted, so a malformed profile cannot inject CSS.
- **First paint:** the deployment's default brand paints first; the brand swaps
  after `/user` resolves. There is no inline bootstrap script and no
  `transformIndexHtml` step.
- **Document metadata:** `applyBrandDocument()` updates `<link rel="icon">` and
  `<meta name="theme-color">`; `hooks/useTabTitle.jsx` reads the brand name.
- **Assets** are file names next to the brand's `brand.json`, resolved through
  `import.meta.glob(..., { query: "?url&no-inline" })` and served as hashed build
  assets with `withBase()` so a sub-path deployment works. Adding a logo is a file
  in the brand folder, not a JavaScript change; there is no public mirror.

## 7. Layout and positions

Three levels, in increasing cost:

| Level | Mechanism | Added by |
| --- | --- | --- |
| Order of existing blocks | `layout.sidebar.sections`, `.header.items`, `.prompt.items`, validated against a known id list | Configuration |
| Visibility of blocks | Omit an id; prefer `features` when the block has a route or model tools | Configuration |
| Structure | Named `variant` (`classic`, `focus`, `compact`), each a coded branch | Code change + test |

Only the first two are free-form. A `variant` is enumerated on purpose:
free-form positions ("prompt top-right") are untestable and drift. Current
anchors: `Pages/ChatPage.tsx` grid, `components/Sidebar/SidebarContent.tsx`
sections, `components/Prompt/*` rows, `components/Footer/CollapsibleFooter.tsx`.

An unknown section id, a duplicated id or an unsupported variant fails the
build.

## 8. Feature gating

A feature switch must be applied in all three places, or users see dead buttons:

1. **Route** — `Route/PublicRoute.tsx` (`/meta`, `/workspace/:id`, `/agent/:id`).
2. **Entry point** — sidebar sections, prompt buttons, settings tabs, header icons.
3. **Behaviour** — agent tool registration and request fields:
   `agent/runAgent.ts`, `agent/workspaceTools.ts`, `agent/connectedAgentTools.ts`,
   `agent/mcp.ts`, `utils/sendMessage.jsx`.

Additional rules from this repository:

- Feature guides (`config/featureGuides.js`) must be filtered by enabled feature;
  hidden UI must not be offered in tours. `npm run validate:guides` stays part of
  the check.
- The Meta chat must be able to read the deployment and brand state. Add brand id,
  deployment id and the resolved feature map to `get_user_settings` and the
  `list_*` tools' output. A mutation proposal is optional and read-only is the
  expected default for branding.
- If a disabled feature should also leave the bundle, the boundary must become a
  dynamic import. Hiding the entry point alone does not remove the code.

## 9. Compatibility with today's configuration

- `secrets/front.json` becomes the Chat AI profile with identical effective
  values. No visual change.
- Existing `modules` semantics are preserved per key. Note that they are currently
  inconsistent: `tools`, `feedback` and `choices` default to off
  (`value?.x || false`), while `agent`, `agents` and `arcanas` default to on
  (`?? true`). The resolver keeps the per-key default and documents it in one
  table; new keys default on so an old profile keeps working.
- `utils/modules.js` and the scattered `import.meta.env.VITE_MODULE_*` reads move
  behind the new `deployment.js` accessors. `VITE_MODULE_*` may remain as the
  transport for the existing keys during the transition.
- `VITE_DEFAULT_SETTINGS`, `VITE_ANNOUNCEMENT`, `VITE_E2EE_KEY_URL` and the model
  keys keep their meaning.

## 10. Build and operations

- **`outDir` collision:** `vite build` currently writes `front/dist`, and
  `docker-compose.yml` bind-mounts `./front`. Two deployments overwrite each
  other. `build.outDir` becomes `dist/<deploymentId>` in the same change.
- **`base`:** hard-coded to `"/"` in `front/vite.config.js`. A deployment served
  under a sub-path (possible for OHB) takes `base` from its profile. It is
  compiled in, so it is a build input.
- **Docker:** one `front` service per deployment, each with its own secret,
  `CONFIG_LOCATION`, port and output directory. `back` is per deployment unless
  deployments share a gateway.
- **Version stamping:** `VersionDisplay` and exported conversations should show
  the deployment id and resolved brand as well as the version. With three
  artifacts, "Chat AI 2.4.1" no longer identifies the build.
- **Drift check:** add a script that resolves and validates all profiles and
  prints the effective diff against `front.base.json`. The repository has no CI
  (`.github/` contains only issue templates), so this is a local or pre-commit
  check; without it, the third profile is the one that breaks.
- **Service worker:** separate origins or paths per deployment. If deployments
  share a domain, `base` and the SW scope must line up so one deployment's cache
  cannot serve another's assets.

Build commands:

```bash
CONFIG_LOCATION=../secrets/front-gaia.json npm run build   # -> dist/gaia
CONFIG_LOCATION=../secrets/front-ohb.json  npm run build   # -> dist/ohb
```

## 11. Branding surfaces to migrate

Verified current locations, all of which must read from `useBrand()` or the
build-time accessors instead of static values:

| Surface | File |
| --- | --- |
| Tab title, favicon | `front/index.html`, `hooks/useTabTitle.jsx` (three hard-coded `"Chat AI"` strings) |
| Header / mobile logo | `components/Header/LogoContainer.jsx` |
| Sidebar rail, services popover | `components/Sidebar/SidebarRail.tsx`, `AiServicesMenu.tsx` |
| Empty conversation | `components/Conversation/EmptyConversation.jsx` |
| Export PDF | `components/Sidebar/Modals/ExportChatModal.jsx` |
| Footer, copyright, ISO line | `components/Footer/CollapsibleFooter.tsx` |
| Help / docs / model links | `Footer`, `modals/Help/HelpModelsModal.jsx`, `HelpArcanaModal.jsx`, `Header/ModelSelectorSimple.tsx`, `ModelSelectorExtended.tsx`, `SettingsPanel/ArcanaContainer.jsx` |
| Logout realm | `modals/UserSettings/UserInfoContainer.jsx` |
| Toolbox title and tool-tour copy | `i18n/en.js`, `i18n/de.js` (`tools_title`, "GWDG Tools" in guides) |

The copy is the largest hidden cost. `en.js` and `de.js` contain GWDG-specific
data-protection claims, the external-model disclaimer and the copyright line.
Those are **legal statements**, not theme strings; on a GAIA or OHB deployment
they may be false. Brand `copy` overrides are therefore part of the profile, and
a name substitution is not sufficient.

## 12. Testing

- **Config resolution:** extends merge (arrays replace, cycles rejected), unknown
  keys rejected, layout ids validated, rule referencing an unknown brand rejected,
  brand profile containing `features`/`layout` rejected, every profile's assets
  exist.
- **Brand resolution:** gateway field wins → first rule → default; unknown id
  falls back; missing or malformed claims are tolerated.
- **UI:** brand swap changes `data-brand`, title and favicon; no brand can remove
  `WarningExternalModel`; a disabled feature leaves no sidebar entry, route or
  agent tool.
- **Guides:** disabled features are not offered by tours; `npm run
  validate:guides` passes.
- **Build:** all profiles build cleanly; `dist/<deployment>` contains only that
  deployment's brand CSS and assets.

Tests live next to the code (`front/src/config/__tests__/`,
`front/src/config/**/__tests__/`) per repository convention. Extended browser
coverage belongs in `e2e/` if a brand or feature regression is worth a scenario.

## 13. Rollout

1. **Extraction only** — `config/deployment.js`, `useBrand()`, and the brand table
   with a single Chat AI entry; every current logo, link and title comes from
   there with byte-identical output. No config key yet.
2. **Two-tier config** — split files, `resolve-config.mjs` with `extends` and
   validation, `outDir`/`base`, the generated brand CSS and the HTML transform.
3. **Runtime brands** — `BrandProvider`, claim/gateway resolution, per-brand
   assets and document metadata.
4. **Layout ordering** — the three ordered lists.
5. **Named layout variants** — only when a deployment actually needs a different
   structure.

Steps 1 and 2 should land before the first non-Chat-AI deployment exists, so the
defaults-preserving extraction is the only change existing deployments see.

## 14. Open decisions

- Does the gateway return a brand id, or must the front map claims? In this
  repository `/user` is a hard-coded placeholder, so runtime branding needs a real
  source before GAIA can serve more than the default brand.
- Can one user belong to several institutions? If so, the precedence above is the
  contract, and an affiliation selector may be wanted.
- Which features are enabled per deployment? A matrix for Chat AI, GAIA and OHB is
  required before the product files can be written.
- Who supplies the legal/data-protection wording per deployment, and may the GWDG
  wording be reused verbatim on GAIA and OHB?
- Do GAIA/OHB need a different layout structure, or only a different section
  order?

## 15. Implemented in the first slice

Everything below was verified in the code and in a browser (Chat AI default,
`?brand=UGOE`, and a build/dev run with `deployment: "minimal"`).

**Config core**

| File | Contents |
| --- | --- |
| `front/src/config/branding/<folder>/brand.json` | One file per brand: name, logo, links, footer, theme, surfaces, aliases and the asset file names. Chat AI lives in `branding/chatai/`, UGOE in `branding/ugoe/`; a partial profile merges over Chat AI. |
| `front/src/config/deployment.js` | `deploymentId` (`VITE_DEPLOYMENT`, default `chat-ai`), `deployment`, `isFeatureEnabled(name)`, `moduleValue(name, fallback)`, `brandConfig`. Unknown ids fall back to `chat-ai`. |
| `front/src/config/brands.js` | `mergeBrand`, `matchBrandId` (id + aliases, case-insensitive), `ruleMatches`, `resolveBrandId`, `brandCss`, `applyBrandDocument`, `withBase`. |
| `front/src/config/BrandProvider.jsx` | Context + `useBrand()`; one `/user` request through `getUserDataCached`, so the page and the brand share it. |
| `front/src/components/Others/BrandLogo.jsx` | Renders `full`/`small`/`mark`; when a `*Dark` asset exists both images are rendered and CSS picks one (`dark:hidden` / `hidden dark:block`). |
| `front/src/utils/modules.js` | One place for the module flags, deployment value first, then the existing `VITE_MODULE_*` semantics. |

Deployment profiles live in `front/src/config/deployments/<id>/index.json` and are
inlined with `import.meta.glob("./deployments/*/index.json", { eager: true })`.
They hold features, modules, the default brand and the claim rules; the brand
content itself lives in `front/src/config/branding/<folder>/`. Both contain no
secrets, so inlining all of them is harmless and keeps `useBrand()` synchronous.

- `deployments/chat-ai/index.json` — every feature on, the default brand
  (`chat-ai`), and the claim rules (`contains "UGOE"` over `brand`, `groups`,
  `entitlements`, `oidc_claim_groups`, `oidc_claim_entitlements`,
  `oidc_claim_ou`; and an `@uni-goettingen.de` mail-domain rule).
- `deployments/minimal/index.json` — `tools`, `feedback`, `choices`, `agent`,
  `agents`, `arcanas` and `speech` off; `workspaces`, `mcp_servers`, `e2ee`,
  `tutorials` and `import_git` off. `meta_chat` stays on: the Meta chat runs on
  stored conversation summaries and its own function tools, so it needs none of
  the modules this profile disables. With `tutorials` off the Meta chat is also
  sent a reduced tool set (`metaTools.js#getMetaToolDefinitions`), because there
  is no tour runtime for it to start.

**Ops side**

- `front/vite.config.js` maps `deployment` → `VITE_DEPLOYMENT` and logs it.
- `secrets/front.json.sample` carries `"deployment": "chat-ai"`;
  `secrets/front-minimal.json.sample` is a runnable minimal installation that
  talks to `back` on `:8081`. The gitignored `secrets/front-minimal.json` can
  instead point at a SAIA engine directly (`/public/v1` + `apiKey` +
  `fakeAuthHeaders`, exactly like `front-local-conf.json`); README has the
  snippet.
- `secrets/.gitignore` re-includes `*.sample`, which `*` would otherwise hide.

**Gates wired**

- Routes: `/meta` (feature `meta_chat`), `/workspace/:workspaceId`, and the
  agents route through `VITE_MODULE_AGENTS`, as before. The `minimal` profile
  keeps `meta_chat` on, so only the workspace and agent routes redirect there.
- Sidebar: Meta chat row, tutorial status, Workspace / Agents / MCP sections.
- Prompt: workspace attach button, attach-from-workspace, tools button, speech.
- Chat: `ChatAgentSidebar`, `TourManager`.
- Settings: the Encryption tab.
- `CreateWorkspaceModal`: the "clone repository" mode is hidden when `import_git`
  is off.
- `metaTools.js` reports the effective module state from `utils/modules.js`, and
  `getMetaToolDefinitions()` drops `list_tutorials` / `start_tutorial` /
  `start_use_case` while the `tutorials` feature is off.

**The UGOE brand**

- Assets: `front/src/config/branding/ugoe/{brand.json,logo.svg,logo-dark.svg,mark.svg,mark-dark.svg,favicon.ico}`
  (print lockup for light, white lockup for dark, a transparent GA mark for the
  sidebar in each mode, and the app icon).
- Palette taken from the university site (`https://uni-goettingen.de/`,
  `/css/default.css`): Universitätsblau `#13306a` for the header/primary buttons,
  link blue `#0078a3`, panel grey `#dee2e8` and navigation blue `#8ab8cf`. The
  app maps those to `primary`, `secondary`/`accent`/`info`, `base300` (a
  blue-tinted `#cfdee8` border) and a `#d6e7f1` chat bubble; the canvas is a
  light `#e4eef5` rather than the site's warm `#f2f0e8` highlight, which would
  tint every screen beige. The sidebar uses
  `surfaces.sidebar` with a light tint of the site's `#8ab8cf` navigation blue
  (`#d7e7f1`, hover `#c5dbea`, border `#b2cddf`, text `#10233a`) so it reads like
  the university's left navigation without the full-strength blue; `#8ab8cf`
  itself is the dark theme's accent. The site has no dark theme, so the
  dark block is a blue-tinted neutral scheme with `#8ab8cf` as the accessible
  light blue on a dark base; the dark sidebar is `#1b2b38`.
- `services: false` replaces the Image/Voice/RAG popover with a plain logo.
- `logo.headerVariant: "mark"` because the university lockup is 5.6:1 and its
  wordmark is illegible at a 40 px-wide sidebar slot.
- Footer: `isoCertified: false` (the ISO 27001 certificate is GWDG's) and its
  privacy entry reads "Data Privacy for UGOE" / "Datenschutz für UGOE" and links
  to `https://uni-goettingen.de/de/439479.html`. The other entries keep the GWDG
  targets until UGOE supplies its own imprint and terms.

**Tests**

`front/src/config/__tests__/{brands,deployment}.test.js`,
`BrandProvider.test.jsx` and
`front/src/components/Footer/__tests__/CollapsibleFooter.test.tsx` (resolution
precedence, rule matching, CSS emission for the whole palette and the sidebar
surface, dark asset pair, document application, minimal profile contents, brand
footer links and the ISO opt-out).

**Known gaps, deliberately left for the next slice**

- `brand.copy` is defined but not consumed; the data-protection wording, external
  model notice and copyright line still come from `i18n/en.js` / `de.js`. The
  footer itself now follows `brand.footer.links` (labels, URLs, visibility and the
  ISO claim), but the help links, export PDF and legal modals still point at GWDG.
  That is defensible because GWDG operates the service, but it is not a finished
  brand.
- No `resolve-config.mjs`: no `extends`, no unknown-key validation, no
  "brand may not contain features/layout" build error. The invariants are upheld by
  the shape of the accessors (`brand` objects are only read for presentation), not
  enforced mechanically yet.
- `outDir`/`base` per deployment, the layout lists, model allow/deny and the
  per-deployment Docker service are not implemented; `npm run build` still writes
  `front/dist`.
- In this repository `/user` is a hard-coded placeholder with no group claims, so
  the IDM rule cannot be exercised locally. Use `?brand=UGOE`; a real deployment
  needs `oidc_claim_groups` (or a gateway `brand` field) in the profile response.
