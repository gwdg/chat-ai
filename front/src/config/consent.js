import { localizeBrandValue } from "./brands.js";

// Consent-gate helpers shared by the forced dialog and the settings panel. A
// brand opts in by declaring `consentGate`; without it nothing is required.

const asObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** The consent gate of a brand, or null when the brand does not use one. */
export const brandConsentGate = (brand) =>
  asObject(brand?.consentGate) ? brand.consentGate : null;

/** The declared purposes, filtered to entries with a usable id. */
export const consentPurposes = (gate) =>
  (Array.isArray(gate?.purposes) ? gate.purposes : []).filter(
    (purpose) => asObject(purpose) && typeof purpose.id === "string" && purpose.id,
  );

/** Answers for a brand-new record: every purpose is opt-in, so all are off. */
export const defaultConsentAnswers = (gate) =>
  Object.fromEntries(
    consentPurposes(gate).map((purpose) => [purpose.id, false]),
  );

/**
 * `true` when the gate exists and this device has no matching acceptance. A
 * changed version invalidates an older record, which is how a brand re-prompts
 * after it rewrites its texts.
 */
export const requiresBrandConsent = (brand, record) => {
  const gate = brandConsentGate(brand);
  if (!gate) return false;
  if (!record) return true;
  const version = gate.version == null ? "" : String(gate.version);
  return version !== String(record.version ?? "");
};

/** One localized string from a brand value (plain string or `{en, de}`). */
export const consentText = (value, language) =>
  localizeBrandValue(value, language);
