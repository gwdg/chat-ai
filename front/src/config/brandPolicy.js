// Brand restrictions: the only place a brand may reach beyond presentation.
//
// A brand is resolved at runtime, per user, so a deployment can serve several
// institutions that each narrow the service differently (a fixed model, modules
// switched off, no options that talk to third parties). The direction is fixed:
// **a brand may only narrow, never widen.** `false` is the only value that is
// honoured, so a brand cannot re-enable a module or feature the deployment
// disabled, and cannot add a model the deployment does not list.
//
// The accessors read the brand through `currentBrand()`, which `BrandProvider`
// keeps in module state, because they are plain functions called from render
// paths, request builders and non-React helpers. React components that must
// react to a late brand resolution read `useBrand()` (App does, which re-renders
// the tree).
import { currentBrand } from "./brands.js";

const asObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const brandRestrictions = (brand) => {
  const restrictions = brand?.restrictions;
  return asObject(restrictions) ? restrictions : {};
};

/** `true` only when a value explicitly disables something. */
const disables = (value) => value === false || value === "false" || value === null;

/** A module the brand switched off. Values never enable one. */
export const brandDisablesModule = (name, brand = currentBrand()) =>
  disables(brandRestrictions(brand).modules?.[name]);

/** A feature the brand switched off. Values never enable one. */
export const brandDisablesFeature = (name, brand = currentBrand()) =>
  disables(brandRestrictions(brand).features?.[name]);

/**
 * Capabilities that leave the institution's trust boundary: web search, external
 * models, user-configured MCP servers and external references in rendered model
 * output. Allowed unless the brand names them with `false`.
 */
export const BRAND_EXTERNAL_KEYS = [
  "web_search",
  "external_models",
  "mcp",
  "external_references",
];

export const isBrandExternalAllowed = (
  kind,
  brand = currentBrand(),
) => !disables(brandRestrictions(brand).external?.[kind]);

/** The model ids a brand pins or permits, normalized. */
export function brandModelPolicy(brand = currentBrand()) {
  const policy = brandRestrictions(brand).models;
  if (!asObject(policy)) return { fixed: null, allowed: null };
  const fixed = typeof policy.fixed === "string" ? policy.fixed.trim() : "";
  const allowed = Array.isArray(policy.allowed)
    ? policy.allowed.filter((id) => typeof id === "string" && id.trim())
    : null;
  return { fixed: fixed || null, allowed: allowed?.length ? allowed : null };
}

/** Same signal the data-safety warning uses for a model. */
export const isExternalModel = (model) =>
  model?.external === true ||
  (typeof model?.name === "string" &&
    model.name.toLowerCase().includes("external"));

/**
 * The model list the UI may offer. `models.fixed` narrows to one id and
 * `models.allowed` to an allowlist; `external.external_models: false` drops the
 * models marked external. When a policy matches nothing (a deployment without
 * that id), the unfiltered list is kept so the app stays usable; the institute
 * section still names the restriction.
 */
export function applyBrandModelPolicy(models, brand = currentBrand()) {
  if (!Array.isArray(models)) return models;
  const { fixed, allowed } = brandModelPolicy(brand);
  let next = models;
  if (!isBrandExternalAllowed("external_models", brand)) {
    next = next.filter((model) => !isExternalModel(model));
    if (!next.length) next = models;
  }
  if (fixed) {
    const pinned = next.filter((model) => model?.id === fixed);
    return pinned.length ? pinned : next;
  }
  if (allowed) {
    const kept = new Set(allowed);
    const permitted = next.filter((model) => kept.has(model?.id));
    return permitted.length ? permitted : next;
  }
  return next;
}

/** The fixed model id, or null. Callers that only need the pin use this. */
export const brandFixedModel = (brand = currentBrand()) =>
  brandModelPolicy(brand).fixed;

const disabledKeys = (value) =>
  asObject(value)
    ? Object.entries(value)
        .filter(([, entry]) => disables(entry))
        .map(([key]) => key)
    : [];

/**
 * A plain description of everything a brand narrows, for the institute section
 * and the Meta chat. Keys are module/feature/external ids; the UI translates
 * them, the Meta chat prints them.
 */
export function brandRestrictionSummary(brand = currentBrand()) {
  const restrictions = brandRestrictions(brand);
  const { fixed, allowed } = brandModelPolicy(brand);
  return {
    model: { fixed, allowed },
    modules: disabledKeys(restrictions.modules),
    features: disabledKeys(restrictions.features),
    external: BRAND_EXTERNAL_KEYS.filter(
      (key) => !isBrandExternalAllowed(key, brand),
    ),
  };
}

/** True when the brand narrows anything at all. */
export const hasBrandRestrictions = (brand = currentBrand()) => {
  const summary = brandRestrictionSummary(brand);
  return (
    Boolean(summary.model.fixed) ||
    Boolean(summary.model.allowed) ||
    summary.modules.length > 0 ||
    summary.features.length > 0 ||
    summary.external.length > 0
  );
};

/**
 * True when Profile → Institution has something to show: an institute block or
 * any narrowing. A brand that only describes who runs the service still gets the
 * screen, so the tab and its feature guide follow this, not `hasBrandRestrictions`.
 */
export const hasBrandInstitute = (brand = currentBrand()) =>
  Boolean(asObject(brand?.institute)) || hasBrandRestrictions(brand);

/** A brand's own links for the institute section, localized by the caller. */
export function brandInstituteLinks(brand) {
  const links = brand?.institute?.links;
  if (Array.isArray(links)) {
    return links.filter((entry) => asObject(entry) && entry.url);
  }
  if (asObject(links)) {
    return Object.entries(links)
      .filter(([, entry]) => asObject(entry) && entry.url)
      .map(([id, entry]) => ({ id, ...entry }));
  }
  return [];
}

/** One plain-text line per restriction, for the Meta chat's settings report. */
export function brandRestrictionLines(brand = currentBrand()) {
  const summary = brandRestrictionSummary(brand);
  const lines = [];
  if (summary.model.fixed) {
    lines.push(`model fixed to ${summary.model.fixed}`);
  } else if (summary.model.allowed) {
    lines.push(`models limited to ${summary.model.allowed.join(", ")}`);
  }
  if (summary.modules.length) {
    lines.push(`modules off: ${summary.modules.join(", ")}`);
  }
  if (summary.features.length) {
    lines.push(`features off: ${summary.features.join(", ")}`);
  }
  if (summary.external.length) {
    lines.push(`external communication off: ${summary.external.join(", ")}`);
  }
  return lines;
}
