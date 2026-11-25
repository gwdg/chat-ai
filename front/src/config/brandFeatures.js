// Brand feature modules: UI and chat tools that only one brand ships.
//
// A feature is a folder `config/branding/<brand>/features/<key>/index.js`. Its
// default export may implement any of:
//
//   fences: { "<markdown language>": Component }  // renderer for a fenced block
//   personaBanner: Component                      // a row inside PersonaChatBanner
//   chatTool: (context) => ({ definitions, run }) // OpenAI function tools
//
// It is enabled only while the *merged* brand profile sets `ui.<key> === true`,
// so an `extends` parent's flag is inherited together with its module. The flag
// is plain brand data, which is also what a feature guide can ask about without
// bundling the component (see config/featureGuides.js).
//
// What a brand may contribute is deliberately narrow: presentation and tools
// that run inside the app. A brand still cannot add a module, a route or a
// setting, and nothing here may widen a restriction (`config/brandPolicy.js`).
import { currentBrand } from "./brands.js";

// `scripts/validate-feature-guides.mjs` imports the guide catalogs in plain Node,
// where `import.meta.glob` does not exist; every definition then falls back to
// empty. The calls must stay literal so Vite can replace them.
const loadGlob = (loader) => {
  try {
    return loader();
  } catch {
    return {};
  }
};

const brandFiles = loadGlob(() =>
  import.meta.glob("./branding/*/brand.json", {
    eager: true,
    import: "default",
  }),
);

const featureModules = loadGlob(() =>
  import.meta.glob("./branding/*/features/*/index.js", {
    eager: true,
  }),
);

const folderOf = (key) => key.split("/")[2];

// Brand id -> folder. The folder only holds the files; `id` inside the JSON is
// the canonical brand id.
const folderById = new Map();
for (const [key, data] of Object.entries(brandFiles)) {
  const folder = folderOf(key);
  folderById.set(data?.id || folder, folder);
}

/** The brand folder and its `extends` ancestors, nearest first. */
export function brandFolderChain(brandId) {
  const chain = [];
  const seen = new Set();
  let id = String(brandId || "").trim();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folderById.get(id);
    if (!folder) break;
    chain.push(folder);
    id = String(brandFiles[`./branding/${folder}/brand.json`]?.extends || "").trim();
  }
  return chain;
}

/** True when the merged brand profile switched the feature on. */
export function brandFeatureFlag(key, brand = currentBrand()) {
  return brand?.ui?.[key] === true;
}

const featureCache = new Map();

/**
 * Every feature module the current brand enables, in folder order (the brand's
 * own folder first, then the folders it extends).
 */
export function brandFeatures(brand = currentBrand()) {
  const brandId = String(brand?.id || "");
  if (featureCache.has(brandId)) return featureCache.get(brandId);

  const features = [];
  const seenKeys = new Set();
  for (const folder of brandFolderChain(brandId)) {
    const prefix = `./branding/${folder}/features/`;
    for (const [key, module] of Object.entries(featureModules)) {
      if (!key.startsWith(prefix)) continue;
      const featureKey = key.slice(prefix.length).split("/")[0];
      const feature = module?.default ?? module;
      if (!feature || typeof feature !== "object") continue;
      // The flag is the module's own key (`course_material`), not necessarily the
      // folder name (`course-material`); a module without a key falls back to it.
      const flagKey = feature.key || featureKey;
      if (!brandFeatureFlag(flagKey, brand)) continue;
      if (seenKeys.has(flagKey)) continue;
      seenKeys.add(flagKey);
      features.push(feature);
    }
  }
  featureCache.set(brandId, features);
  return features;
}

/** The fenced-block renderer a feature registered for `language`, if any. */
export function brandFence(language) {
  const value = String(language || "").trim().toLowerCase();
  if (!value) return null;
  for (const feature of brandFeatures()) {
    const component = feature.fences?.[value];
    if (component) return component;
  }
  return null;
}

/** The components a feature contributes to the persona chat banner. */
export function brandPersonaBanners() {
  return brandFeatures()
    .map((feature) => feature.personaBanner)
    .filter(Boolean);
}

/**
 * The app-side function tools every feature contributes to this conversation,
 * merged into one `{ definitions, run }`. `run(name, args)` resolves the tool to
 * the feature that defined it.
 */
export function brandChatTool(context) {
  const definitions = [];
  const runners = new Map();
  for (const feature of brandFeatures()) {
    if (typeof feature.chatTool !== "function") continue;
    let contributed = null;
    try {
      contributed = feature.chatTool(context);
    } catch (error) {
      console.warn("Could not build a brand chat tool", error);
      continue;
    }
    if (!contributed) continue;
    for (const definition of contributed.definitions || []) {
      const name = definition?.function?.name;
      if (!name || runners.has(name)) continue;
      runners.set(name, (args) => contributed.run(name, args));
      definitions.push(definition);
    }
  }
  if (definitions.length === 0) return null;
  return {
    definitions,
    run: async (name, args) => {
      const runner = runners.get(name);
      if (!runner) throw new Error(`Unknown tool: ${name}`);
      return runner(args);
    },
  };
}

/** Test helper: forget the per-brand feature list. */
export function clearBrandFeatureCache() {
  featureCache.clear();
}
