import { afterEach, describe, expect, it } from "vitest";

import {
  applyBrandModelPolicy,
  brandDisablesFeature,
  brandDisablesModule,
  brandFixedModel,
  brandInstituteLinks,
  brandRestrictionLines,
  brandRestrictionSummary,
  hasBrandInstitute,
  hasBrandRestrictions,
  isBrandExternalAllowed,
} from "../brandPolicy";
import {
  brandCss,
  getBrandProfile,
  setCurrentBrand,
} from "../brands";
import { isFeatureEnabled, moduleValue } from "../deployment";

const MODELS = [
  { id: "qwen3-30b-a3b-instruct-2507", name: "Qwen3" },
  { id: "llama-4", name: "Llama 4" },
  { id: "gpt-external", name: "GPT (External)", external: true },
];

const restricted = () => getBrandProfile("restricted");

afterEach(() => {
  setCurrentBrand(null);
});

describe("brand restrictions", () => {
  it("describes the restricted example brand", () => {
    const summary = brandRestrictionSummary(restricted());
    expect(summary.model.fixed).toBe("qwen3-30b-a3b-instruct-2507");
    expect(summary.model.allowed).toBeNull();
    expect(summary.modules).toEqual([
      "agent",
      "agents",
      "arcanas",
      "speech",
      "sync",
    ]);
    expect(summary.features).toEqual([
      "workspaces",
      "mcp_servers",
      "import_git",
    ]);
    expect(summary.external).toEqual([
      "web_search",
      "external_models",
      "mcp",
      "external_references",
    ]);
    expect(hasBrandRestrictions(restricted())).toBe(true);
  });

  it("leaves an unrestricted brand alone", () => {
    const brand = getBrandProfile("chat-ai");
    expect(hasBrandRestrictions(brand)).toBe(false);
    expect(brandRestrictionSummary(brand)).toEqual({
      model: { fixed: null, allowed: null },
      modules: [],
      features: [],
      external: [],
    });
    expect(brandRestrictionLines(brand)).toEqual([]);
    expect(applyBrandModelPolicy(MODELS, brand)).toBe(MODELS);
    expect(brandCss(brand)).toBe("");
  });

  it("gives an institute-only brand the Institution screen", () => {
    // Describing who provides the service is enough; it need not narrow anything.
    expect(hasBrandInstitute({ institute: { name: "Example" } })).toBe(true);
    expect(hasBrandInstitute(restricted())).toBe(true);
    expect(hasBrandInstitute(getBrandProfile("chat-ai"))).toBe(false);
    expect(hasBrandInstitute(getBrandProfile("ugoe"))).toBe(true);
  });

  it("applies the fixed and the allowlist model policy", () => {
    expect(
      applyBrandModelPolicy(MODELS, restricted()).map((model) => model.id),
    ).toEqual(["qwen3-30b-a3b-instruct-2507"]);

    const allowlisted = {
      restrictions: { models: { allowed: ["llama-4", "made-up"] } },
    };
    expect(
      applyBrandModelPolicy(MODELS, allowlisted).map((model) => model.id),
    ).toEqual(["llama-4"]);
    expect(brandFixedModel(allowlisted)).toBeNull();
  });

  it("drops external models and keeps the list usable when a pin is missing", () => {
    const noExternal = { restrictions: { external: { external_models: false } } };
    expect(
      applyBrandModelPolicy(MODELS, noExternal).map((model) => model.id),
    ).toEqual(["qwen3-30b-a3b-instruct-2507", "llama-4"]);

    const missingPin = { restrictions: { models: { fixed: "not-offered" } } };
    expect(applyBrandModelPolicy(MODELS, missingPin)).toBe(MODELS);
  });

  it("only narrows modules and features, never enables them", () => {
    setCurrentBrand(restricted());
    // A module the brand switches off is off even though the deployment enables it.
    expect(moduleValue("agent", true)).toBe(false);
    expect(moduleValue("tools", false)).toBe(false);
    // A feature the brand switches off is off.
    expect(isFeatureEnabled("workspaces")).toBe(false);
    expect(isFeatureEnabled("mcp_servers")).toBe(false);
    // A feature the brand does not name keeps the deployment value.
    expect(isFeatureEnabled("meta_chat")).toBe(true);

    // A value that would enable something is ignored.
    setCurrentBrand({
      restrictions: { modules: { tools: true }, features: { workspaces: true } },
    });
    expect(moduleValue("tools", false)).toBe(false);
    expect(brandDisablesModule("tools")).toBe(false);
    expect(brandDisablesFeature("workspaces")).toBe(false);
  });

  it("reports external capabilities and institutional links", () => {
    const brand = restricted();
    expect(isBrandExternalAllowed("web_search", brand)).toBe(false);
    expect(isBrandExternalAllowed("mcp", brand)).toBe(false);
    expect(isBrandExternalAllowed("something-else", brand)).toBe(true);

    const links = brandInstituteLinks(brand);
    expect(links).toHaveLength(2);
    expect(links[0].url).toBe("https://example.org/it/chat-ai");
    expect(brandInstituteLinks(getBrandProfile("chat-ai"))).toEqual([]);
  });

  it("describes the UGOE restrictions in a line", () => {
    const brand = getBrandProfile("ugoe");
    expect(isBrandExternalAllowed("web_search", brand)).toBe(false);
    expect(isBrandExternalAllowed("external_models", brand)).toBe(false);
    expect(isBrandExternalAllowed("mcp", brand)).toBe(true);
    expect(brandRestrictionLines(brand)).toEqual([
      "external communication off: web_search, external_models",
    ]);
  });
});
