import DOMPurify from "dompurify";

// Same-page anchors, relative paths, data: URIs and mailto:/tel: links stay on
// our origin (or need no network). Protocol-relative and absolute URLs with a
// scheme point at another host.
export const isExternalUrl = (value) => {
  const v = (value || "").trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (
    lower.startsWith("#") ||
    lower.startsWith("data:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return false;
  }
  if (/^\/\//.test(lower)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(lower)) return true;
  return false;
};

const URL_ATTRS = new Set([
  "src",
  "href",
  "xlink:href",
  "poster",
  "action",
  "formaction",
  "data",
]);

const srcsetHasExternalUrl = (value) =>
  String(value || "")
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .some((url) => isExternalUrl(url));

const styleHasExternalUrl = (value) => {
  const css = String(value || "");
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match;
  while ((match = urlPattern.exec(css))) {
    if (isExternalUrl(match[2])) return true;
  }
  return false;
};

export const blockExternalRefHook = (node, data) => {
  const name = (data.attrName || "").toLowerCase();
  if (URL_ATTRS.has(name) && isExternalUrl(data.attrValue)) {
    data.keepAttr = false;
    return;
  }
  if (name === "srcset" && srcsetHasExternalUrl(data.attrValue)) {
    data.keepAttr = false;
    return;
  }
  if (name === "style" && styleHasExternalUrl(data.attrValue)) {
    data.keepAttr = false;
  }
};

// DOMPurify hooks are global on the instance. sanitize() is synchronous, so
// adding the hook around a single sanitize call and removing it afterwards is
// safe and reentrant.
export const sanitizeExternalRefs = (loadExternal, sanitize) => {
  if (loadExternal) return sanitize();
  DOMPurify.addHook("uponSanitizeAttribute", blockExternalRefHook);
  try {
    return sanitize();
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute", blockExternalRefHook);
  }
};
