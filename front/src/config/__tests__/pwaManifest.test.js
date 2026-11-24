import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getBrandProfile } from "../brands";
import { applyBrandManifest } from "../pwaManifest";

const manifestLink = () => document.querySelector('link[rel="manifest"]');

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(
  URL,
  "createObjectURL",
);
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
  URL,
  "revokeObjectURL",
);

let createObjectURL;

beforeEach(() => {
  document.head.innerHTML =
    '<link rel="manifest" href="/site.webmanifest" crossorigin="use-credentials" />';
  createObjectURL = vi.fn(() => "blob:brand-manifest");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
  } else {
    delete URL.createObjectURL;
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
  } else {
    delete URL.revokeObjectURL;
  }
});

// A manifest fetch omits credentials unless the link asks for them, so a build
// behind a login gateway answers 401 for /site.webmanifest on every page load.
describe("web app manifest link", () => {
  it("keeps the static fallback and asks for credentials", () => {
    applyBrandManifest(getBrandProfile("restricted"));
    const link = manifestLink();
    expect(link.getAttribute("href")).toBe("/site.webmanifest");
    expect(link.getAttribute("crossorigin")).toBe("use-credentials");
  });

  it("adds the credential attribute to an existing link", () => {
    document.head.innerHTML = '<link rel="manifest" href="/site.webmanifest" />';
    applyBrandManifest(null);
    expect(manifestLink().getAttribute("crossorigin")).toBe("use-credentials");
  });

  it("creates the link with the credential attribute", () => {
    document.head.innerHTML = "";
    applyBrandManifest(null);
    const link = manifestLink();
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/site.webmanifest");
    expect(link.getAttribute("crossorigin")).toBe("use-credentials");
  });

  it("installs a brand manifest as a Blob URL", () => {
    applyBrandManifest(getBrandProfile("gaia"));
    expect(manifestLink().getAttribute("href")).toBe("blob:brand-manifest");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0][0].type).toBe(
      "application/manifest+json",
    );
  });
});

describe("the static shell", () => {
  it("requests the manifest with credentials", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toMatch(
      /<link[^>]+rel="manifest"[^>]+crossorigin="use-credentials"/,
    );
  });
});
