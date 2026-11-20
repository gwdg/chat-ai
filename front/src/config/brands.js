import { brandConfig } from "./deployment";
import { BRAND_OVERRIDE_KEY } from "./brandIds";

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalize = (value) => String(value ?? "").trim().toLowerCase();

// One folder per brand: `config/branding/<folder>/brand.json` plus the images it
// names. The folder is only a container; `id` inside the JSON is the brand id.
// Imported assets become hashed build URLs, so a brand folder is the only place
// its identity lives — there is no public mirror to keep in sync.
const brandModules = import.meta.glob("./branding/*/brand.json", {
  eager: true,
  import: "default",
});

const assetModules = import.meta.glob("./branding/*/*.{svg,png,ico,pdf}", {
  eager: true,
  import: "default",
  query: "?url&no-inline",
});

// Disclaimers and system prompts are inlined, because they are rendered as
// HTML/text and never fetched as a file.
const rawModules = import.meta.glob("./branding/*/*.{html,md}", {
  eager: true,
  import: "default",
  query: "?raw",
});

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

// A localized value may be one file name or one per language, so the shape is
// preserved and each entry resolved like an asset.
const resolveContent = (folder, value) => {
  // Text is inlined, so a file name that does not resolve must render nothing
  // rather than the name itself; an absolute URL is kept as written.
  const read = (file) =>
    typeof file === "string" && /^(?:[a-z]+:|\/|data:|#)/i.test(file)
      ? file
      : (rawModules[`./branding/${folder}/${file}`] ?? null);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([language, file]) => [language, read(file)]),
    );
  }
  return read(value);
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
      header: isPlainObject(data.header)
        ? {
            ...data.header,
            logo: resolveFile(folder, data.header.logo, assetModules),
          }
        : data.header,
      disclaimer: resolveContent(folder, data.disclaimer),
      chatDisclaimer: resolveContent(folder, data.chatDisclaimer),
      systemPrompt: resolveContent(folder, data.systemPrompt),
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
export function mergeBrand(base, override) {
  if (!isPlainObject(override)) return override ?? base;
  const result = { ...(isPlainObject(base) ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
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
  const override = brandProfiles[brandId] ?? {};
  return mergeBrand(baseBrand, { ...override, id: brandId });
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

/**
 * The dark values must target `body.dark`, because index.css re-declares `--chat`
 * and the base colours there; a root-only rule would be shadowed on <body>.
 * `<html>` carries `.dark` too (ThemeToggle and index.css both key off it), so
 * `:root.dark` gets the same block: otherwise the light palette wins at the html
 * level and everything inherited from there — its `color` included — stays
 * light-mode (dark text on a dark page). The light block is scoped with
 * `:not(.dark)` for the same reason. Surface rules are split the same way, so a
 * brand that defines no dark surface values does not paint its light sidebar on
 * a dark page.
 */
export function brandCss(brand) {
  const light = declarations(brand?.theme?.light);
  const dark = declarations(brand?.theme?.dark);
  const sidebarLight = declarations(brand?.surfaces?.sidebar?.light, SURFACE_TOKENS);
  const sidebarDark = declarations(brand?.surfaces?.sidebar?.dark, SURFACE_TOKENS);
  return [
    light ? `:root:not(.dark) { ${light} }` : "",
    dark ? `:root.dark, body.dark { ${dark} }` : "",
    sidebarLight ? `body:not(.dark) .brand-sidebar { ${sidebarLight} }` : "",
    sidebarDark ? `body.dark .brand-sidebar { ${sidebarDark} }` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function applyBrandDocument(brand) {
  if (typeof document === "undefined" || !brand) return;
  document.documentElement.dataset.brand = brand.id;

  let style = document.getElementById("brand-theme");
  if (!style) {
    style = document.createElement("style");
    style.id = "brand-theme";
    document.head.appendChild(style);
  }
  style.textContent = brandCss(brand);

  const icon = document.querySelector('link[rel="icon"]');
  if (icon && brand.assets?.favicon) {
    icon.setAttribute("href", withBase(brand.assets.favicon));
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor && isColor(brand.theme?.light?.primary)) {
    themeColor.setAttribute("content", brand.theme.light.primary);
  }
}
