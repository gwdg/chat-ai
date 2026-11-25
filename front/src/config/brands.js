import { brandConfig } from "./brandConfig.js";
import { BRAND_OVERRIDE_KEY } from "./brandIds.js";

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalize = (value) => String(value ?? "").trim().toLowerCase();

// `scripts/validate-feature-guides.mjs` imports the feature-guide catalogs in
// plain Node, which reaches this module through `featureGuides -> brands`. Vite
// replaces each literal `import.meta.glob` at build time; outside Vite it does
// not exist, so every definition falls back to empty and the validator still
// sees the catalog shape (it never resolves a brand's files). The calls must stay
// literal: Vite cannot transform a glob whose pattern is a variable.
const loadGlob = (loader) => {
  try {
    return loader();
  } catch {
    return {};
  }
};

// One folder per brand: `config/branding/<folder>/brand.json` plus the images it
// names. The folder is only a container; `id` inside the JSON is the brand id.
// Imported assets become hashed build URLs, so a brand folder is the only place
// its identity lives — there is no public mirror to keep in sync.
const brandModules = loadGlob(() =>
  import.meta.glob("./branding/*/brand.json", {
    eager: true,
    import: "default",
  }),
);

const assetModules = loadGlob(() => ({
  ...import.meta.glob("./branding/*/*.{svg,png,ico,pdf,woff2}", {
    eager: true,
    import: "default",
    query: "?url&no-inline",
  }),
  // A brand may keep its webfonts in a subfolder of its own (`fonts/`).
  ...import.meta.glob("./branding/*/*/*.woff2", {
    eager: true,
    import: "default",
    query: "?url&no-inline",
  }),
}));

// Disclaimers and system prompts are inlined, because they are rendered as
// HTML/text and never fetched as a file.
const rawModules = loadGlob(() =>
  import.meta.glob("./branding/*/*.{html,md}", {
    eager: true,
    import: "default",
    query: "?raw",
  }),
);

const folderOf = (key) => key.split("/")[2];

// A value that looks like a URL or a leading slash is already resolved; anything
// else names a file next to the brand's `brand.json`.
const resolveFile = (folder, value, modules) => {
  const isPath =
    typeof value === "string" && !/^(?:[a-z]+:|\/|data:|#)/i.test(value);
  return isPath ? modules[`./branding/${folder}/${value}`] ?? value : value;
};

const resolveAssets = (folder, assets) => {
  if (!isPlainObject(assets)) return assets;
  const resolved = {};
  for (const [key, value] of Object.entries(assets)) {
    resolved[key] = resolveFile(folder, value, assetModules);
  }
  return resolved;
};

// A brand may ship its own webfont. `faces[]` names one file per style/weight
// range; the files are resolved like every other asset, so Vite emits them as
// hashed build assets and no font is ever fetched from a third party.
const resolveFonts = (folder, fonts) => {
  if (!isPlainObject(fonts)) return fonts;
  return {
    ...fonts,
    faces: Array.isArray(fonts.faces)
      ? fonts.faces.map((face) =>
          isPlainObject(face)
            ? { ...face, file: resolveFile(folder, face.file, assetModules) }
            : face,
        )
      : fonts.faces,
  };
};

// PWA icons live in the brand folder too, so an installed app shows the brand
// mark. `src` is resolved the same way as any other brand image.
const resolvePwa = (folder, pwa) => {
  if (!isPlainObject(pwa)) return pwa;
  return {
    ...pwa,
    icons: Array.isArray(pwa.icons)
      ? pwa.icons.map((icon) =>
          isPlainObject(icon)
            ? { ...icon, src: resolveFile(folder, icon.src, assetModules) }
            : icon,
        )
      : pwa.icons,
  };
};

// A localized content value is either inline copy (`"<p>…</p>"`) or the name of
// a file next to `brand.json` (`"disclaimer.en.html"`). A name with a markdown or
// HTML extension is looked up and renders nothing when it does not resolve, so a
// typo never prints a file name; anything else is inline text.
const CONTENT_FILE = /\.(?:html?|md)$/i;

const resolveContent = (folder, value) => {
  // A key the brand does not define must stay `undefined`, not `null`: the
  // `extends` merge treats `null` as an explicit erase, so returning `null`
  // here silently dropped an inherited disclaimer, chat notice or system
  // prompt. A defined file name that does not resolve still yields `null`.
  if (value === undefined) return undefined;
  const read = (file) => {
    if (typeof file !== "string") return null;
    // An absolute URL is kept as written.
    if (/^(?:[a-z]+:|\/|data:|#)/i.test(file)) return file;
    if (!CONTENT_FILE.test(file)) return file;
    return rawModules[`./branding/${folder}/${file}`] ?? null;
  };
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([language, file]) => [language, read(file)]),
    );
  }
  return read(value);
};

// Static information pages a brand may ship (`pages.about`,
// `pages.accessibility`). Each entry is localized copy like a disclaimer, so a
// brand that does not name one simply has no such page.
const resolvePages = (folder, pages) => {
  if (!isPlainObject(pages)) return pages;
  return Object.fromEntries(
    Object.entries(pages).map(([id, value]) => [
      id,
      resolveContent(folder, value),
    ]),
  );
};

const loadBrands = () => {
  const profiles = {};
  for (const [key, module] of Object.entries(brandModules)) {
    const folder = folderOf(key);
    const data = module ?? {};
    const id = data.id || folder;
    profiles[id] = {
      ...data,
      id,
      assets: resolveAssets(folder, data.assets),
      // The AI marker is rendered as an image, so its file resolves like any
      // other brand asset (it used to stay a bare file name and rendered broken).
      aiMarker: isPlainObject(data.aiMarker)
        ? {
            ...data.aiMarker,
            asset: resolveFile(folder, data.aiMarker.asset, assetModules),
          }
        : data.aiMarker,
      header: isPlainObject(data.header)
        ? {
            ...data.header,
            logo: resolveFile(folder, data.header.logo, assetModules),
          }
        : data.header,
      disclaimer: resolveContent(folder, data.disclaimer),
      chatDisclaimer: resolveContent(folder, data.chatDisclaimer),
      systemPrompt: resolveContent(folder, data.systemPrompt),
      pages: resolvePages(folder, data.pages),
      fonts: resolveFonts(folder, data.fonts),
      pwa: resolvePwa(folder, data.pwa),
      footer: isPlainObject(data.footer)
        ? {
            ...data.footer,
            help: resolveFile(folder, data.footer.help, assetModules),
          }
        : data.footer,
    };
  }
  return profiles;
};

const brandProfiles = loadBrands();

// Everything is merged over Chat AI, so a brand file may be partial and a new
// deployment can change its default without duplicating the common values.
const baseBrand =
  brandProfiles["chat-ai"] ?? Object.values(brandProfiles)[0] ?? {};

// Objects merge recursively; arrays and primitives replace. This is what lets a
// brand override one colour or one link without repeating the whole profile.
// `undefined` means "not set" (a partial brand loads missing files as
// `undefined`), so it never erases an inherited value; `null` still does.
export function mergeBrand(base, override) {
  if (!isPlainObject(override)) return override ?? base;
  const result = { ...(isPlainObject(base) ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] = isPlainObject(value) ? mergeBrand(result[key], value) : value;
  }
  return result;
}

/** Case-insensitive id or alias lookup. Returns the canonical id or null. */
export function matchBrandId(candidate) {
  const value = normalize(candidate);
  if (!value) return null;
  for (const brand of Object.values(brandProfiles)) {
    if (normalize(brand.id) === value) return brand.id;
    const aliases = Array.isArray(brand.aliases) ? brand.aliases : [];
    if (aliases.some((alias) => normalize(alias) === value)) return brand.id;
  }
  return null;
}

/** The fully merged profile for a canonical brand id, or null when unknown. */
export function getBrandProfile(id) {
  const brandId = matchBrandId(id);
  if (!brandId) return null;
  const resolved = resolveBrandProfile(brandId);
  if (!resolved) return null;
  return mergeBrand(baseBrand, { ...resolved, id: brandId });
}

/**
 * `extends: "<brand>"` lets a sub-brand inherit another brand folder instead of
 * duplicating it. The parent is resolved first and the child is merged over it;
 * an unknown parent or a cycle falls back to the child alone (which still merges
 * over Chat AI), so a broken brand file can never break boot.
 */
function resolveBrandProfile(brandId, seen = new Set()) {
  const raw = brandProfiles[brandId];
  if (!raw || seen.has(brandId)) return null;
  seen.add(brandId);
  const parentId = raw.extends;
  const own = { ...raw };
  delete own.extends;
  const parent = parentId
    ? resolveBrandProfile(matchBrandId(parentId) ?? parentId, seen)
    : null;
  return parent
    ? mergeBrand(parent, { ...own, id: brandId })
    : { ...own, id: brandId };
}

export const defaultBrandId = () =>
  matchBrandId(brandConfig.default) ?? baseBrand.id;

export const defaultBrandProfile = () =>
  getBrandProfile(defaultBrandId()) ?? baseBrand;

/**
 * A brand text value is either a string or a map of language code to string.
 * The UI language wins, then English, then the first value.
 */
export function localizeBrandValue(value, language = "") {
  if (value == null) return undefined;
  if (typeof value !== "object") return value;
  const languageCode = String(language).split("-")[0];
  return (
    value[language] ??
    value[languageCode] ??
    value.en ??
    Object.values(value)[0]
  );
}

const claimValues = (userData, claims) => {
  const names = Array.isArray(claims) ? claims : [claims];
  const values = [];
  for (const name of names) {
    if (!name) continue;
    const value = userData?.[name];
    if (Array.isArray(value)) values.push(...value.map(String));
    else if (value !== undefined && value !== null) values.push(String(value));
  }
  return values;
};

/**
 * A rule matches one claim or a list of claims. `contains` also works for group
 * lists such as `oidc_claim_groups` where an entry may be `UGOE:members`.
 */
export function ruleMatches(rule, userData) {
  const values = claimValues(userData, rule?.claims ?? rule?.claim);
  if (values.length === 0) return false;
  const target = normalize(rule.equals ?? rule.contains ?? rule.suffix);
  if (rule.equals != null) return values.some((v) => normalize(v) === target);
  if (rule.contains != null) return values.some((v) => normalize(v).includes(target));
  if (rule.suffix != null) return values.some((v) => normalize(v).endsWith(target));
  if (Array.isArray(rule.oneOf)) {
    const allowed = new Set(rule.oneOf.map(normalize));
    return values.some((v) => allowed.has(normalize(v)));
  }
  return false;
}

/** `?brand=UGOE` in the current URL, if it names a known brand. */
export function brandFromSearch(search) {
  try {
    return matchBrandId(new URLSearchParams(search).get("brand"));
  } catch {
    return null;
  }
}

/**
 * Precedence: testing override (query/session) > gateway field > claim rules >
 * deployment default. An unknown id never breaks the page.
 */
export function resolveBrandId({ userData, search, override } = {}) {
  return (
    brandFromSearch(search) ??
    matchBrandId(override) ??
    matchBrandId(userData?.[brandConfig.trustedField]) ??
    brandConfig.rules.reduce(
      (found, rule) =>
        found ?? (ruleMatches(rule, userData) ? matchBrandId(rule.brand) : null),
      null,
    ) ??
    defaultBrandId()
  );
}

// Non-React callers (getDefaultConversation) cannot read context. BrandProvider
// applies its claim-resolved brand here after the profile request answers.
let appliedBrand = null;

export function setCurrentBrand(brand) {
  appliedBrand = brand ?? null;
}

/**
 * The active brand for modules outside React. The query and the stored testing
 * override are read live, then the brand BrandProvider applied, then the
 * deployment default — the same precedence, without the async user claims.
 */
export function currentBrand() {
  const search = typeof window === "undefined" ? "" : window.location.search;
  let stored = null;
  try {
    stored = matchBrandId(sessionStorage.getItem(BRAND_OVERRIDE_KEY));
  } catch {
    // Private mode or blocked storage: no override.
  }
  const overrideId = brandFromSearch(search) ?? stored;
  if (overrideId) return getBrandProfile(overrideId) ?? defaultBrandProfile();
  return appliedBrand ?? defaultBrandProfile();
}

/** Prefix a public path with Vite's base, leaving imported asset URLs alone. */
export const withBase = (value) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return value;
  const base = import.meta.env.BASE_URL || "/";
  if (base === "/") return value;
  // `?url` imports already carry the base; prefixing again would duplicate it.
  const root = base.replace(/\/$/, "");
  return value === root || value.startsWith(`${root}/`)
    ? value
    : `${root}${value}`;
};

// Every token the chatai daisyUI theme declares in index.css. A brand may
// override any subset; the rest keeps the Chat AI value. `chat` is the user
// message bubble colour.
const THEME_TOKENS = {
  primary: "--color-primary",
  primaryContent: "--color-primary-content",
  secondary: "--color-secondary",
  secondaryContent: "--color-secondary-content",
  accent: "--color-accent",
  accentContent: "--color-accent-content",
  neutral: "--color-neutral",
  neutralContent: "--color-neutral-content",
  base100: "--color-base-100",
  base200: "--color-base-200",
  base300: "--color-base-300",
  baseContent: "--color-base-content",
  info: "--color-info",
  infoContent: "--color-info-content",
  success: "--color-success",
  successContent: "--color-success-content",
  warning: "--color-warning",
  warningContent: "--color-warning-content",
  error: "--color-error",
  errorContent: "--color-error-content",
  chat: "--chat",
};

const isColor = (value) => /^#[0-9a-f]{3,8}$/i.test(String(value ?? ""));

// `--chat` is only an input: `@theme` in index.css declares
// `--color-chat: var(--chat)` once on `:root`, where the substitution happens.
// A brand that repaints `--chat` further down therefore never reaches `bg-chat`,
// and the user bubble keeps the light value. Emit the resolved token too.
const CHAT_ALIAS = "--color-chat";

// Named UI surfaces a brand may repaint. The sidebar is the only one today; a
// new class (`brand-<surface>`) is the whole mechanism: the rule overrides the
// daisyUI variables inside that subtree, so every existing utility
// (`bg-base-100`, `text-accent`, `hover:bg-base-200`, …) follows along.
const SURFACE_TOKENS = {
  background: "--color-base-100",
  hover: "--color-base-200",
  border: "--color-base-300",
  content: "--color-base-content",
  accent: "--color-accent",
};

const declarations = (values, tokens = THEME_TOKENS) =>
  Object.entries(tokens)
    .filter(([key]) => isColor(values?.[key]))
    .flatMap(([key, cssVar]) =>
      cssVar === "--chat"
        ? [`${cssVar}: ${values[key]};`, `${CHAT_ALIAS}: ${values[key]};`]
        : [`${cssVar}: ${values[key]};`],
    )
    .join(" ");

// daisyUI shape tokens a brand may set. Values are validated so a brand file
// cannot inject arbitrary CSS: radii accept 0 or rem/px/em, the border accepts a
// px value, and depth is a unitless number.
const SHAPE_TOKENS = {
  radiusSelector: "--radius-selector",
  radiusField: "--radius-field",
  radiusBox: "--radius-box",
  border: "--border",
  depth: "--depth",
};

const RADIUS_VALUE = /^(?:0|(?:\d+\.?\d*|\.\d+)(?:rem|px|em))$/;
const BORDER_VALUE = /^(?:\d+\.?\d*|\.\d+)px$/;
const DEPTH_VALUE = /^(?:\d+\.?\d*|\.\d+)$/;

const shapeValue = (key, value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (key === "border") return BORDER_VALUE.test(raw) ? raw : null;
  if (key === "depth") return DEPTH_VALUE.test(raw) ? raw : null;
  return RADIUS_VALUE.test(raw) ? raw : null;
};

const shapeDeclarations = (values) =>
  Object.entries(SHAPE_TOKENS)
    .map(([key, cssVar]) => {
      const value = shapeValue(key, values?.[key]);
      return value ? `${cssVar}: ${value};` : "";
    })
    .filter(Boolean)
    .join(" ");

// `brand.themes[]` are fully custom palettes on top of the default light/dark
// pair. The id becomes a CSS attribute selector, so it must stay a plain slug.
const THEME_ID = /^[a-z0-9][a-z0-9_-]*$/i;

/** The usable custom themes of a brand, in declaration order. */
export const brandThemes = (brand) =>
  (Array.isArray(brand?.themes) ? brand.themes : []).filter(
    (theme) => isPlainObject(theme) && THEME_ID.test(String(theme.id ?? "")),
  );

// Brand webfonts: one `@font-face` per declared face plus the base family.
// `--font-sans`/`--default-font-family` cover Tailwind's preflight and the
// explicit `html, body` rule covers non-utility text.
const fontCss = (fonts) => {
  if (!isPlainObject(fonts) || !fonts.family) return "";
  const family = String(fonts.family).replace(/"/g, "");
  const fallback = fonts.fallback || "system-ui, -apple-system, sans-serif";
  const faces = (Array.isArray(fonts.faces) ? fonts.faces : [])
    .filter((face) => isPlainObject(face) && face.file)
    .map(
      (face) =>
        `@font-face { font-family: "${family}"; src: url("${face.file}") format("woff2"); font-style: ${face.style || "normal"}; font-weight: ${face.weight || "normal"}; font-display: ${face.display || "swap"};${
          face.unicodeRange ? ` unicode-range: ${face.unicodeRange};` : ""
        } }`,
    );
  const stack = `"${family}", ${fallback}`;
  return [
    ...faces,
    `:root { --font-sans: ${stack}; --font-display: ${stack}; --default-font-family: ${stack}; }`,
    `html, body { font-family: ${stack}; }`,
  ].join("\n");
};

/**
 * The dark values must target `body.dark`, because index.css re-declares `--chat`
 * and the base colours there; a root-only rule would be shadowed on <body>.
 * `<html>` carries `.dark` too (App and index.css both key off it), so
 * `:root.dark` gets the same block: otherwise the light palette wins at the html
 * level and everything inherited from there — its `color` included — stays
 * light-mode (dark text on a dark page). The light block is scoped with
 * `:not(.dark)` for the same reason. Surface rules are split the same way, so a
 * brand that defines no dark surface values does not paint its light sidebar on
 * a dark page.
 *
 * A custom theme is emitted last, scoped to `[data-brand-theme="<id>"]` on both
 * `<html>` and `<body>`. Same specificity as the light/dark blocks but later in
 * the sheet, so it wins while the active theme is set.
 */
export function brandCss(brand, activeThemeId = null) {
  const light = declarations(brand?.theme?.light);
  const dark = declarations(brand?.theme?.dark);
  const sidebarLight = declarations(brand?.surfaces?.sidebar?.light, SURFACE_TOKENS);
  const sidebarDark = declarations(brand?.surfaces?.sidebar?.dark, SURFACE_TOKENS);
  const font = fontCss(brand?.fonts);
  const shape = shapeDeclarations(brand?.shape);
  const custom = brandThemes(brand).find((theme) => theme.id === activeThemeId);
  const customBlock = custom
    ? `:root[data-brand-theme="${custom.id}"], body[data-brand-theme="${custom.id}"] { ${declarations(custom.colors)} ${shapeDeclarations(custom.shape ?? brand?.shape)} }`
    : "";
  return [
    font,
    shape ? `:root { ${shape} }` : "",
    light ? `:root:not(.dark) { ${light} }` : "",
    dark ? `:root.dark, body.dark { ${dark} }` : "",
    sidebarLight ? `body:not(.dark) .brand-sidebar { ${sidebarLight} }` : "",
    sidebarDark ? `body.dark .brand-sidebar { ${sidebarDark} }` : "",
    customBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The brand theme selected by id, or null for the default light/dark pair. */
export const activeBrandTheme = (brand, themeId) =>
  brandThemes(brand).find((theme) => theme.id === themeId) ?? null;

export function applyBrandDocument(brand, themeId = null) {
  if (typeof document === "undefined" || !brand) return;
  document.documentElement.dataset.brand = brand.id;

  const theme = activeBrandTheme(brand, themeId);
  for (const target of [document.documentElement, document.body]) {
    if (!target) continue;
    if (theme) target.dataset.brandTheme = theme.id;
    else delete target.dataset.brandTheme;
  }

  let style = document.getElementById("brand-theme");
  if (!style) {
    style = document.createElement("style");
    style.id = "brand-theme";
    document.head.appendChild(style);
  }
  style.textContent = brandCss(brand, theme?.id);

  const icon = document.querySelector('link[rel="icon"]');
  if (icon && brand.assets?.favicon) {
    icon.setAttribute("href", withBase(brand.assets.favicon));
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const color =
    theme?.colors?.primary ??
    brand.pwa?.themeColor ??
    brand.theme?.light?.primary;
  if (themeColor && isColor(color)) {
    themeColor.setAttribute("content", color);
  }
}
