import { describe, expect, it, vi } from "vitest";

import {
  brandCss,
  defaultBrandId,
  getBrandProfile,
  matchBrandId,
  resolveBrandId,
  ruleMatches,
  withBase,
} from "../brands";

describe("brand lookup", () => {
  it("resolves the default Chat AI brand", () => {
    expect(defaultBrandId()).toBe("chat-ai");
    const brand = getBrandProfile("chat-ai");
    expect(brand?.name).toBe("Chat AI");
    expect(brand?.theme).toEqual({ light: {}, dark: {} });
    // Its images live next to `brand.json` and resolve to build assets.
    expect(brand?.assets.full).toContain("branding/chatai/logo.svg");
    expect(brand?.assets.export).toContain("branding/chatai/logo.png");
    expect(brand?.assets.favicon).toContain("branding/chatai/favicon.ico");
    // The default footer keeps the built-in link order and the GWDG ISO claim.
    expect(Object.keys(brand?.footer?.links ?? {})).toEqual([
      "imprint",
      "privacy",
      "terms",
      "docs",
    ]);
    expect(brand?.footer?.isoCertified).toBe(true);
  });

  it("lets a sub-brand rename one footer link without dropping the others", () => {
    const brand = getBrandProfile("ugoe");
    expect(brand.footer.links.privacy.label).toEqual({
      en: "Data Privacy for UGOE",
      de: "Datenschutz für UGOE",
    });
    expect(brand.footer.links.privacy.url).toBe(
      "https://uni-goettingen.de/de/439479.html",
    );
    expect(brand.footer.links.imprint).toEqual({});
    expect(brand.footer.isoCertified).toBe(false);
  });

  it("matches the UGOE brand case-insensitively and by alias", () => {
    expect(matchBrandId("UGOE")).toBe("ugoe");
    expect(matchBrandId("ugoe")).toBe("ugoe");
    expect(matchBrandId("Göttingen")).toBe("ugoe");
    expect(matchBrandId("not-a-brand")).toBeNull();
  });

  it("merges a sub-brand over the defaults", () => {
    const brand = getBrandProfile("ugoe");
    expect(brand.id).toBe("ugoe");
    expect(brand.name).toBe("Chat AI");
    expect(brand.services).toBe(false);
    expect(brand.assets.full).toContain("branding/ugoe/logo.svg");
    // The sidebar uses the transparent GA mark, with a white counterpart for dark mode.
    expect(brand.assets.mark).toContain("branding/ugoe/mark.svg");
    expect(brand.assets.markDark).toContain("branding/ugoe/mark-dark.svg");
    expect(brand.theme.light.primary).toBe("#13306a");
    // Links the sub-brand does not override keep the Chat AI defaults.
    expect(brand.links.imprint).toContain("gwdg.de");
    // The PDF export logo is inherited from Chat AI after the merge.
    expect(brand.assets.export).toContain("branding/chatai/logo.png");
  });
});

describe("brand resolution", () => {
  it("prefers a known ?brand= override", () => {
    expect(resolveBrandId({ search: "?brand=UGOE" })).toBe("ugoe");
    expect(resolveBrandId({ search: "?brand=UGOE", userData: null })).toBe(
      "ugoe",
    );
  });

  it("ignores an unknown override and falls back", () => {
    expect(resolveBrandId({ search: "?brand=NOPE" })).toBe("chat-ai");
    expect(resolveBrandId({ override: "NOPE" })).toBe("chat-ai");
  });

  it("uses the gateway brand field", () => {
    expect(resolveBrandId({ userData: { brand: "UGOE" } })).toBe("ugoe");
  });

  it("matches a group claim containing UGOE", () => {
    expect(
      resolveBrandId({
        userData: { oidc_claim_groups: ["staff", "UGOE:members"] },
      }),
    ).toBe("ugoe");
  });

  it("matches the university mail domain", () => {
    expect(
      resolveBrandId({ userData: { email: "someone@uni-goettingen.de" } }),
    ).toBe("ugoe");
  });

  it("falls back to the default for unrelated users", () => {
    expect(
      resolveBrandId({ userData: { email: "someone@example.org" } }),
    ).toBe("chat-ai");
  });

  it("matches oneOf and suffix rules", () => {
    expect(
      ruleMatches({ claim: "groups", oneOf: ["a", "UGOE"] }, { groups: ["UGOE"] }),
    ).toBe(true);
    expect(
      ruleMatches(
        { claims: ["email"], suffix: "@uni-goettingen.de" },
        { email: "x@uni-goettingen.de" },
      ),
    ).toBe(true);
    expect(ruleMatches({ claim: "groups", equals: "UGOE" }, { groups: [] })).toBe(
      false,
    );
  });
});

describe("brand theme", () => {
  it("emits light and dark blocks for the whole palette", () => {
    const css = brandCss(getBrandProfile("ugoe"));
    expect(css).toContain(":root {");
    expect(css).toContain("--color-primary: #13306a;");
    expect(css).toContain("--color-primary-content: #ffffff;");
    expect(css).toContain("--color-base-200: #e4eef5;");
    expect(css).toContain("--color-info: #0078a3;");
    expect(css).toContain("body.dark {");
    expect(css).toContain("--color-primary: #8ab8cf;");
    expect(css).toContain("--color-base-100: #232a33;");
  });

  it("repaints the sidebar surface, including its hover and border tokens", () => {
    const css = brandCss(getBrandProfile("ugoe"));
    expect(css).toContain(
      "body:not(.dark) .brand-sidebar { --color-base-100: #d7e7f1; --color-base-200: #c5dbea; --color-base-300: #b2cddf; --color-base-content: #10233a; --color-accent: #13306a; }",
    );
    expect(css).toContain(
      "body.dark .brand-sidebar { --color-base-100: #1b2b38;",
    );
  });

  it("ignores a surface value that is not a colour", () => {
    const css = brandCss({
      surfaces: { sidebar: { light: { background: "url(javascript:1)" } } },
    });
    expect(css).toBe("");
  });

  it("emits nothing for the unchanged default", () => {
    expect(brandCss(getBrandProfile("chat-ai"))).toBe("");
  });

  it("drops values that are not colours", () => {
    expect(
      brandCss({ theme: { light: { primary: "url(javascript:1)" } } }),
    ).toBe("");
  });

  it("prefixes build asset paths with the Vite base", () => {
    expect(withBase("/assets/logo.svg")).toBe("/assets/logo.svg");
    expect(withBase("https://example.org/logo.svg")).toBe(
      "https://example.org/logo.svg",
    );
  });

  it("does not prefix an imported asset twice on a sub-path deployment", () => {
    vi.stubEnv("BASE_URL", "/app/");
    try {
      expect(withBase("/app/assets/logo.svg")).toBe("/app/assets/logo.svg");
      expect(withBase("/chat")).toBe("/app/chat");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
