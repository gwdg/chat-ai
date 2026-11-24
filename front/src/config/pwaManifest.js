import { localizeBrandValue, withBase } from "./brands";

// Web app manifest support. `index.html` ships a static Chat AI fallback
// (`/site.webmanifest`); a brand that declares `pwa` replaces it at runtime with
// a Blob URL, so an installed app carries the brand name, colours and icons.
// The service worker that makes the app installable is produced by the build
// (`vite-plugins/staticAssets.js`); this module only supplies the manifest.

const origin = () =>
  typeof location === "undefined" ? "" : location.origin || "";

const absolute = (value) => {
  if (!value) return value;
  const path = withBase(value);
  if (/^(?:[a-z]+:|\/\/)/i.test(path)) return path;
  return `${origin()}${path.startsWith("/") ? "" : "/"}${path}`;
};

/** The localized name a brand shows in the install prompt. */
const brandName = (brand) =>
  localizeBrandValue(brand?.pwa?.name, "") ||
  brand?.name ||
  localizeBrandValue(brand?.shortName, "");

/**
 * The manifest for a brand, or null when the brand has no PWA configuration.
 * Icons come from the brand folder (`brand.pwa.icons[].src` is resolved by the
 * brand loader to a build asset URL).
 */
export function buildBrandManifest(brand) {
  const pwa = brand?.pwa;
  if (!pwa || typeof pwa !== "object") return null;
  const name = brandName(brand);
  if (!name) return null;
  const icons = (Array.isArray(pwa.icons) ? pwa.icons : [])
    .filter((icon) => icon?.src)
    .map((icon) => ({
      src: absolute(icon.src),
      sizes: icon.sizes || "any",
      type: icon.type || "image/png",
      ...(icon.purpose ? { purpose: icon.purpose } : {}),
    }));
  return {
    id: absolute(pwa.id || "/"),
    name,
    short_name:
      localizeBrandValue(pwa.shortName, "") || brand?.shortName || name,
    description: localizeBrandValue(pwa.description, "") || brand?.description,
    // The manifest is served from a Blob URL, which has no hierarchy, so its
    // scope and start URL must be absolute rather than resolved against it.
    start_url: absolute(pwa.startUrl || "/"),
    scope: absolute("/"),
    display: pwa.display || "standalone",
    orientation: pwa.orientation || "any",
    background_color: pwa.backgroundColor || "#ffffff",
    theme_color: pwa.themeColor || "#ffffff",
    ...(icons.length ? { icons } : {}),
  };
}

let defaultManifestHref = null;
let objectUrl = null;

const manifestLink = () => {
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  // A manifest fetch omits credentials unless the element asks for them, so a
  // deployment behind login answers 401 for the same-origin file. `index.html`
  // ships the attribute; keep it here for a link this module creates or a brand
  // rewrites, and for a Blob URL (also same-origin, so CORS is satisfied).
  if (link.getAttribute("crossorigin") !== "use-credentials") {
    link.setAttribute("crossorigin", "use-credentials");
  }
  return link;
};

/**
 * Install the brand manifest, or restore the static fallback when the brand has
 * none. Safe to call repeatedly: it revokes the previous Blob URL.
 */
export function applyBrandManifest(brand) {
  if (typeof document === "undefined") return;
  const link = manifestLink();
  if (defaultManifestHref === null) {
    defaultManifestHref = link.getAttribute("href") || "/site.webmanifest";
  }

  const manifest = buildBrandManifest(brand);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  if (!manifest) {
    link.setAttribute("href", defaultManifestHref);
    return;
  }

  objectUrl = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
  );
  link.setAttribute("href", objectUrl);

  const appleIcon =
    brand?.pwa?.appleTouchIcon ||
    brand?.pwa?.icons?.find((icon) => /180x180/.test(icon?.sizes || ""))?.src;
  const touch = document.querySelector('link[rel="apple-touch-icon"]');
  if (touch && appleIcon) {
    touch.setAttribute("href", absolute(appleIcon));
  }
}
