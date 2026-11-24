import {
  brandDisablesFeature,
  brandDisablesModule,
} from "./brandPolicy.js";
import {
  deployment,
  deploymentId,
  hasDeployment,
} from "./deploymentProfiles.js";

// Deployment profiles (features, modules, brand rules) live in
// `deployments/<id>/index.json`; `deploymentProfiles.js` loads them and this
// module is the accessor layer. A resolved brand may additionally narrow a
// deployment (see `brandPolicy.js`), never widen it.
export { deployment, deploymentId, hasDeployment };

// Features default on: a deployment that predates a switch keeps it.
export const resolveFeature = (profile, name) =>
  profile?.features?.[name] !== false;

/** The deployment value, before any brand restriction. */
export const isDeploymentFeatureEnabled = (name) =>
  resolveFeature(deployment, name);

/** The effective feature flag: the deployment's value, narrowed by the brand. */
export const isFeatureEnabled = (name) =>
  !brandDisablesFeature(name) && isDeploymentFeatureEnabled(name);

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

/** The deployment value, before any brand restriction. */
export const deploymentModuleValue = (name, fallback) =>
  resolveModuleValue(deployment, name, fallback);

/** The effective module value: a brand may switch a module off, never on. */
export const moduleValue = (name, fallback) =>
  brandDisablesModule(name) ? false : deploymentModuleValue(name, fallback);

/**
 * The deployment's brand selection. Re-exported for the existing importers;
 * `brands.js` reads it from `brandConfig.js` to keep the module graph acyclic.
 */
export { brandConfig } from "./brandConfig.js";
