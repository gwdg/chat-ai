import { DEFAULT_BRAND_ID } from "./brandIds.js";
import { deployment } from "./deploymentProfiles.js";

// Brand selection is part of the deployment profile: which brand is the default,
// which profile field may name one, and the claim rules. `brands.js` reads this
// module, so it must not import the deployment accessors (that would be a cycle).
export const brandConfig = {
  default: deployment?.brands?.default ?? DEFAULT_BRAND_ID,
  trustedField: deployment?.brands?.trustedField ?? "brand",
  rules: Array.isArray(deployment?.brands?.rules) ? deployment.brands.rules : [],
};
