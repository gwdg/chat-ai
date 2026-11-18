import { DEFAULT_BRAND_ID } from "./brandIds.js";

// Build-time deployment profile. `deployment` in secrets/front.json becomes
// VITE_DEPLOYMENT, which selects one directory under src/config/deployments/.
// The JSON files hold no secrets, so inlining all of them is harmless and keeps
// the runtime and the tests free of a second fetch or an async bootstrap.
//
// `scripts/validate-feature-guides.mjs` loads this module in plain Node (via
// featureGuides -> utils/modules), where `import.meta.glob` and `import.meta.env`
// do not exist. The try/catch and the `env || {}` fallback keep that working;
// Vite still replaces the call and the object inside them at build time.
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

// Features default on: a deployment that predates a switch keeps it.
export const resolveFeature = (profile, name) =>
  profile?.features?.[name] !== false;

export const isFeatureEnabled = (name) => resolveFeature(deployment, name);

// Modules keep the semantics of secrets/front.json when the deployment profile
// does not name them: tools/feedback/choices are opt-in, agent/agents/arcanas
// are opt-in to disable, speech carries a value rather than a boolean.
export const resolveModuleValue = (profile, name, fallback) => {
  const modules = profile?.modules;
  if (modules && Object.prototype.hasOwnProperty.call(modules, name)) {
    return modules[name];
  }
  return fallback;
};

export const moduleValue = (name, fallback) =>
  resolveModuleValue(deployment, name, fallback);

export const brandConfig = {
  default: deployment?.brands?.default ?? DEFAULT_BRAND_ID,
  trustedField: deployment?.brands?.trustedField ?? "brand",
  rules: Array.isArray(deployment?.brands?.rules) ? deployment.brands.rules : [],
};
