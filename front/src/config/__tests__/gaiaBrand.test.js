import { describe, expect, it } from "vitest";

import {
  activeBrandTheme,
  brandCss,
  brandThemes,
  getBrandProfile,
  localizeBrandValue,
  matchBrandId,
} from "../brands";
import { buildBrandManifest } from "../pwaManifest";

const gaia = () => getBrandProfile("gaia");

describe("GAIA brand", () => {
  it("resolves by id and alias", () => {
    expect(matchBrandId("GAIA")).toBe("gaia");
    expect(matchBrandId("gaia-student")).toBe("gaia");
    expect(gaia().name).toBe("GAIA");
    expect(gaia().shortName).toBe("GAIA");
  });

  it("resolves its images and fonts to build assets", () => {
    const brand = gaia();
    expect(brand.assets.full).toContain("branding/gaia/logo.svg");
    expect(brand.assets.fullDark).toContain("branding/gaia/logo-dark.svg");
    expect(brand.assets.aiLabel).toContain("branding/gaia/ai-label.svg");
    // The marker is rendered as an <img>, so its own field must resolve too.
    expect(brand.aiMarker.asset).toContain("branding/gaia/ai-label.svg");
    expect(brand.assets.export).toContain("branding/gaia/export.png");
    expect(brand.fonts.family).toBe("Atkinson Hyperlegible Next");
    for (const face of brand.fonts.faces) {
      expect(face.file).toContain("branding/gaia/fonts/");
    }
  });

  it("inlines the chat notice and its watermark", () => {
    const brand = gaia();
    expect(brand.chatDisclaimer.en).toContain("GAIA is an AI system");
    expect(brand.chatDisclaimer.de).toContain("GAIA ist ein KI-System");
    expect(brand.chatDisclaimerDismissible).toBe(true);
    expect(localizeBrandValue(brand.aiMarker.watermark, "en")).toContain(
      "Generated with GAIA",
    );
    expect(brand.aiMarker.monochrome).toBe(true);
  });

  it("turns the risky features off and allows external models for testing", () => {
    const brand = gaia();
    expect(brand.services).toBe(false);
    expect(brand.restrictions.modules.agents).toBe(false);
    expect(brand.restrictions.features.workspaces).toBe(false);
    // Temporarily allowed so the local test stack's bridge models are usable;
    // every bridge model is labelled "(External)" there. Restore `false` before
    // a student deployment.
    expect(brand.restrictions.external.external_models).toBe(true);
  });

  it("fixes the model, GWDG Tools and the chat settings, and hides the controls", () => {
    const brand = gaia();
    expect(brand.restrictions.models.fixed).toBe("deepseek-v4.1-flash-1017");
    expect(brand.restrictions.locks.tools).toBe(true);
    expect(brand.restrictions.locks.chat_settings).toBe(true);
    // The model name and the data-safety indicator are not needed when GAIA
    // decides the model.
    expect(brand.restrictions.ui.model_selector).toBe(false);
    expect(brand.restrictions.ui.external_warning).toBe(false);
    // The teaching-staff sub-brand inherits the locks unless it unlocks one.
    const tutor = getBrandProfile("gaia-tutor");
    expect(tutor.restrictions.models.fixed).toBe("deepseek-v4.1-flash-1017");
    expect(tutor.restrictions.locks.tools).toBe(true);
    expect(tutor.restrictions.locks.chat_settings).toBe(true);
    expect(tutor.restrictions.ui.model_selector).toBe(false);
  });
});

describe("brand themes", () => {
  it("lists the extra themes and ignores a malformed id", () => {
    expect(brandThemes(gaia()).map((theme) => theme.id)).toEqual([
      "business",
      "green",
    ]);
    // A theme id becomes a CSS attribute selector, so it must stay a slug.
    expect(brandThemes({ themes: [{ id: "bad id" }, { id: "ok" }] })).toHaveLength(
      1,
    );
    expect(brandThemes({})).toEqual([]);
  });

  it("selects a theme by id and returns null for the default pair", () => {
    expect(activeBrandTheme(gaia(), "business")?.colorScheme).toBe("dark");
    expect(activeBrandTheme(gaia(), "green")?.colorScheme).toBe("light");
    expect(activeBrandTheme(gaia(), "default")).toBeNull();
    expect(activeBrandTheme(gaia(), null)).toBeNull();
  });

  it("emits the custom theme last, scoped to its data attribute", () => {
    const css = brandCss(gaia(), "business");
    expect(css).toContain(
      ':root[data-brand-theme="business"], body[data-brand-theme="business"] {',
    );
    expect(css).toContain("--color-primary: #1c4e80;");
    expect(css).toContain("--radius-box: 0.5rem;");

    // A light-only theme still emits its own palette.
    const green = brandCss(gaia(), "green");
    expect(green).toContain('body[data-brand-theme="green"]');
    expect(green).toContain("--color-primary: #378100;");

    // The custom block comes after the light and dark blocks.
    expect(css.indexOf(':root.dark, body.dark {')).toBeLessThan(
      css.indexOf(':root[data-brand-theme="business"]'),
    );
  });

  it("emits the brand webfont and shape tokens", () => {
    const css = brandCss(gaia());
    expect(css).toContain('@font-face { font-family: "Atkinson Hyperlegible Next"');
    expect(css).toContain("--font-sans:");
    expect(css).toContain("--radius-field: 1rem;");
    expect(css).toContain("--border: 1px;");
    // An invalid radius is dropped rather than injected.
    expect(
      brandCss({ shape: { radiusBox: "1rem; background: red" } }),
    ).not.toContain("background: red");
  });
});

describe("brand extends", () => {
  it("merges the tutor brand over GAIA", () => {
    const tutor = getBrandProfile("gaia-tutor");
    expect(matchBrandId("gaia-tutor")).toBe("gaia-tutor");
    expect(matchBrandId("GAIA-TUTOR")).toBe("gaia-tutor");
    expect(tutor.id).toBe("gaia-tutor");
    // Inherited from the parent folder.
    expect(tutor.name).toBe("GAIA");
    expect(tutor.assets.full).toContain("branding/gaia/logo.svg");
    expect(tutor.consentGate.version).toBe("2026-02");
    expect(tutor.themes).toHaveLength(2);
    // The child does not define these, so they must not be erased to `null`
    // by the loader (a `null` would override the parent in `mergeBrand`).
    expect(tutor.chatDisclaimer.en).toContain("GAIA is an AI system");
    expect(tutor.chatDisclaimerDismissible).toBe(true);
    expect(tutor.disclaimer).toBeUndefined();
    expect(tutor.systemPrompt).toBeUndefined();
    expect(tutor.aiMarker.asset).toContain("branding/gaia/ai-label.svg");
    // Overridden by the child.
    expect(tutor.institute.description.en).toContain("teaching staff");
    expect(tutor.restrictions.modules.agents).toBe(true);
    expect(tutor.restrictions.features.workspaces).toBe(true);
    // Allowed in both brands while the local test stack is in use.
    expect(tutor.restrictions.external.external_models).toBe(true);
    expect(tutor.extends).toBeUndefined();
  });

  it("keeps an unrelated brand independent of GAIA", () => {
    // A brand without `extends` inherits only Chat AI, never another folder.
    const base = getBrandProfile("chat-ai");
    expect(base.id).toBe("chat-ai");
    expect(base.consentGate).toBeUndefined();
    expect(base.aiMarker).toBeUndefined();
  });
});

describe("GAIA web app manifest", () => {
  it("builds a brand manifest with its own icons", () => {
    const manifest = buildBrandManifest(gaia());
    expect(manifest.name).toBe("GAIA – Study assistant");
    expect(manifest.short_name).toBe("GAIA");
    expect(manifest.theme_color).toBe("#132d6c");
    expect(manifest.background_color).toBe("#f9f5ec");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toHaveLength(3);
    expect(manifest.icons[0].src).toContain("branding/gaia/icon-192.png");
    expect(manifest.icons[2].purpose).toBe("maskable");
    // The manifest is absolute so an installed app resolves it from any URL.
    expect(manifest.start_url).toMatch(/^https?:\/\//);
  });

  it("returns null for a brand without PWA data", () => {
    expect(buildBrandManifest(getBrandProfile("restricted"))).toBeNull();
    expect(buildBrandManifest(null)).toBeNull();
  });
});
