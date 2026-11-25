import { afterEach, describe, expect, it } from "vitest";

import { getBrandProfile, setCurrentBrand } from "../brands";
import {
  brandChatTool,
  brandFeatureFlag,
  brandFeatures,
  brandFence,
  brandFolderChain,
  brandPersonaBanners,
  clearBrandFeatureCache,
} from "../brandFeatures";

const useBrand = (id) => {
  setCurrentBrand(id ? getBrandProfile(id) : null);
  clearBrandFeatureCache();
};

afterEach(() => useBrand(null));

describe("brand folder chain", () => {
  it("follows extends, nearest folder first", () => {
    // The folder is a container; the brand id comes from brand.json.
    expect(brandFolderChain("chat-ai")).toEqual(["chatai"]);
    expect(brandFolderChain("gaia-tutor")).toEqual(["gaia-tutor", "gaia"]);
    expect(brandFolderChain("unknown-brand")).toEqual([]);
  });

  it("survives a cycle without repeating a folder", () => {
    const chain = brandFolderChain("gaia");
    expect(new Set(chain).size).toBe(chain.length);
  });
});

describe("brand feature flags", () => {
  it("reads the merged brand data and inherits through extends", () => {
    expect(brandFeatureFlag("course_material", getBrandProfile("gaia"))).toBe(true);
    expect(brandFeatureFlag("course_material", getBrandProfile("gaia-tutor"))).toBe(
      true,
    );
    expect(brandFeatureFlag("course_material", getBrandProfile("chat-ai"))).toBe(
      false,
    );
    expect(brandFeatureFlag("not_a_feature", getBrandProfile("gaia"))).toBe(
      false,
    );
  });
});

describe("brandFeatures", () => {
  it("collects the modules the brand switched on", () => {
    const gaia = brandFeatures(getBrandProfile("gaia"));
    expect(gaia.map((feature) => feature.key)).toEqual(["course_material"]);
    expect(brandFeatures(getBrandProfile("chat-ai"))).toEqual([]);
  });

  it("inherits the module in a brand that extends the parent", () => {
    useBrand("gaia-tutor");
    expect(brandFence("gaia-quiz")).toBeTruthy();
  });
});

describe("brandFence", () => {
  it("resolves a registered fence language for the active brand only", () => {
    useBrand("gaia");
    expect(brandFence("gaia-quiz")).toBeTruthy();
    expect(brandFence(" GAIA-QUIZ ")).toBeTruthy();
    expect(brandFence("mermaid")).toBeNull();
    expect(brandFence("")).toBeNull();

    useBrand("chat-ai");
    expect(brandFence("gaia-quiz")).toBeNull();
  });
});

describe("brandPersonaBanners", () => {
  it("returns the banner components of the active brand", () => {
    useBrand("gaia");
    expect(brandPersonaBanners()).toHaveLength(1);

    useBrand("chat-ai");
    expect(brandPersonaBanners()).toEqual([]);
  });
});

describe("brandChatTool", () => {
  it("merges the contributed definitions and resolves their runner", () => {
    useBrand("gaia");
    const tools = brandChatTool({ persona: { courseId: "c-programmierung" } });
    expect(
      tools.definitions.map((definition) => definition.function.name),
    ).toContain("show_course_quiz");
    expect(typeof tools.run).toBe("function");
    return expect(tools.run("missing_tool", {})).rejects.toThrow(/unknown tool/i);
  });

  it("contributes nothing when the feature has no input", () => {
    useBrand("gaia");
    // A persona chat that is not a course gets no quiz tool.
    expect(brandChatTool({ persona: null })).toBeNull();

    useBrand("chat-ai");
    expect(
      brandChatTool({ persona: { courseId: "c-programmierung" } }),
    ).toBeNull();
  });
});
