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
  isBrandLocked,
  isBrandUiVisible,
} from "../brandPolicy";
import {
  brandCss,
  getBrandProfile,
  mergeBrand,
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
    // A pinned model has nothing to choose, so its selector is locked too.
    expect(summary.locks).toEqual(["model"]);
    expect(summary.ui).toEqual([]);
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
      locks: [],
      ui: [],
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

  it("locks the settings a brand marks as fixed", () => {
    const locked = {
      restrictions: { locks: { tools: true, chat_settings: true } },
    };
    expect(isBrandLocked("tools", locked)).toBe(true);
    expect(isBrandLocked("chat_settings", locked)).toBe(true);
    // Not locked, and a value other than `true` never locks.
    expect(isBrandLocked("model", locked)).toBe(false);
    expect(isBrandLocked("tools", { restrictions: { locks: { tools: false } } })).toBe(
      false,
    );
    // A pinned model is locked without naming it in `locks`.
    expect(isBrandLocked("model", restricted())).toBe(true);
    // The GAIA brand fixes the model, GWDG Tools and the chat settings.
    expect(isBrandLocked("model", getBrandProfile("gaia"))).toBe(true);
    expect(isBrandLocked("tools", getBrandProfile("gaia"))).toBe(true);
    expect(isBrandLocked("chat_settings", getBrandProfile("gaia"))).toBe(true);
    expect(brandRestrictionLines(getBrandProfile("gaia"))).toContain(
      "settings locked: model, tools, chat_settings",
    );
  });

  it("lets a brand hide controls without locking their values", () => {
    const minimal = {
      restrictions: { ui: { model_selector: false } },
    };
    expect(isBrandUiVisible("model_selector", minimal)).toBe(false);
    expect(isBrandUiVisible("external_warning", minimal)).toBe(true);
    // Only `false` hides anything, and the summary/line follow it.
    expect(brandRestrictionSummary(minimal).ui).toEqual(["model_selector"]);
    expect(brandRestrictionLines(minimal)).toContain(
      "controls hidden: model_selector",
    );
    expect(hasBrandRestrictions(minimal)).toBe(true);
    // GAIA removes the model control and the data-safety indicator.
    const gaia = getBrandProfile("gaia");
    expect(isBrandUiVisible("model_selector", gaia)).toBe(false);
    expect(isBrandUiVisible("external_warning", gaia)).toBe(false);
    // A sub-brand may bring one back; dropping it from the file would inherit
    // the parent's `false`, so an explicit `true` is the opt-out.
    const child = mergeBrand(gaia, { restrictions: { ui: { model_selector: true } } });
    expect(isBrandUiVisible("model_selector", child)).toBe(true);
    expect(isBrandUiVisible("external_warning", child)).toBe(false);
  });

  it("lets a sub-brand unlock one of its parent's settings", () => {
    const child = {
      extends: "gaia",
      restrictions: { locks: { tools: false } },
    };
    // `extends` resolves through the loader, so mergeBrand is what a child gets.
    const merged = mergeBrand(getBrandProfile("gaia"), child);
    expect(isBrandLocked("tools", merged)).toBe(false);
    expect(isBrandLocked("chat_settings", merged)).toBe(true);
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
