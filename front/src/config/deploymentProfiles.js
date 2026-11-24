// Build-time deployment profiles. `deployment` in secrets/front.json becomes
// VITE_DEPLOYMENT, which selects one directory under src/config/deployments/.
// The JSON files hold no secrets, so inlining all of them is harmless and keeps
// the runtime and the tests free of a second fetch or an async bootstrap.
//
// This module is deliberately dependency-free: `deployment.js` (the accessors)
// and `brandConfig.js` (the brand claim rules) both read it, and the brand policy
// reads the brand, so keeping the loading here avoids an import cycle.
//
// `scripts/validate-feature-guides.mjs` loads this module in plain Node (via
// featureGuides -> utils/modules -> deployment/brands), where `import.meta.glob`
// and `import.meta.env` do not exist. The try/catch and the `env || {}` fallback
// keep that working; Vite still replaces the call and the object inside them at
// build time.
function loadProfiles() {
  try {
    return import.meta.glob("./deployments/*/index.json", { eager: true });
  } catch {
    return {};
  }
}

const profiles = loadProfiles();
const env = import.meta.env || {};

export const deploymentId = env.VITE_DEPLOYMENT || "chat-ai";

const active = profiles[`./deployments/${deploymentId}/index.json`]?.default;
const fallback = profiles["./deployments/chat-ai/index.json"]?.default;

export const deployment = active ?? fallback ?? {};

/** True when the configured deployment directory exists. */
export const hasDeployment = Boolean(active);
