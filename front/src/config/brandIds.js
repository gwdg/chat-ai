// The id of the built-in Chat AI brand. It lives in its own module so
// `config/deployment.js` can fall back to it without importing the brand loader,
// whose asset globs and module imports plain Node cannot load (the feature-guide
// validator loads the deployment config through utils/modules).
export const DEFAULT_BRAND_ID = "chat-ai";

// The `?brand=` testing override is kept for the visit in sessionStorage so
// client-side navigation does not drop it. It is never a resolved brand.
export const BRAND_OVERRIDE_KEY = "chatai.brand.override";

/** Remove the testing override, e.g. before a logout redirect. */
export function clearBrandOverride() {
  try {
    sessionStorage.removeItem(BRAND_OVERRIDE_KEY);
  } catch {
    // Private mode or blocked storage: nothing was stored either.
  }
}
