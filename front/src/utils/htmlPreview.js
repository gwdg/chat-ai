import DOMPurify from "dompurify";

import { sanitizeExternalRefs } from "./externalRefs";

/**
 * The HTML policy shared by every place that renders untrusted or user-supplied HTML:
 * fenced ```html blocks in messages and the HTML file preview in the document panel.
 *
 * `buildHtmlCsp` is the network policy ("CORS" in the browser): it is delivered as a
 * <meta http-equiv="Content-Security-Policy"> in the sandboxed iframe and derived from the
 * two HTML preferences, so both renderers reach the network under the same rules.
 */

/* ------------------------------------------------
 * Element/attribute allowlists
 * ------------------------------------------------ */

export const SAFE_HTML_TAGS = [
  "a", "abbr", "b", "bdi", "bdo", "blockquote", "br", "caption", "cite",
  "code", "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl",
  "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "q",
  "s", "samp", "small", "span", "strong", "sub", "summary", "sup", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
];

export const SAFE_HTML_ATTRS = [
  "href", "src", "alt", "title", "width", "height",
  "colspan", "rowspan", "scope", "start", "type", "value",
  "datetime", "cite", "open",
];

// Extra tags/attributes permitted only when the user opts into relaxed
// sanitization so interactive HTML (buttons, forms, iframes, scripts, inline
// styles) can run. Untrusted model output can execute code with this setting.
export const RELAXED_HTML_TAGS = [
  "button", "form", "iframe", "input", "label", "legend", "option", "select",
  "style", "textarea", "script", "canvas", "audio", "video", "source",
  "progress", "meter", "output", "fieldset", "datalist", "optgroup",
];
export const RELAXED_HTML_ATTRS = [
  "style", "class", "id", "name", "for", "action", "method", "target",
  "placeholder", "checked", "selected", "disabled", "readonly", "required",
  "rows", "cols", "maxlength", "min", "max", "step", "pattern", "autocomplete",
  "contenteditable", "tabindex", "role", "aria-label", "controls", "autoplay",
  "loop", "muted", "poster", "frameborder", "allow", "allowfullscreen",
  "sandbox", "download", "rel", "data", "onclick", "onchange", "oninput",
  "onkeydown", "onkeyup", "onkeypress", "onmouseover", "onmouseout",
  "onmousedown", "onmouseup", "onfocus", "onblur", "onsubmit", "onload",
  "onerror",
];

/* ------------------------------------------------
 * Sanitizers
 * ------------------------------------------------ */

// Sanitizes a raw HTML fragment that is rendered as markdown (never relaxed).
//
// When loadExternal is false, URL-bearing attributes that point to an external
// host are dropped for privacy, so the browser never contacts third parties.
// This covers src, href, xlink:href, poster, action, formaction, data, srcset
// and CSS url() inside style. Same-page anchors, relative paths, data: URIs
// and mailto: are kept (see utils/externalRefs.js).
export const sanitizeHtmlFragment = (html, relaxed = false, loadExternal = true) =>
  sanitizeExternalRefs(loadExternal, () =>
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: relaxed
        ? [...SAFE_HTML_TAGS, ...RELAXED_HTML_TAGS]
        : SAFE_HTML_TAGS,
      ALLOWED_ATTR: relaxed
        ? [...SAFE_HTML_ATTRS, ...RELAXED_HTML_ATTRS]
        : SAFE_HTML_ATTRS,
      ALLOW_DATA_ATTR: relaxed,
    })
  );

// Like sanitizeHtmlFragment but also permits embedded <svg> (including filters
// and gradients) so fenced HTML blocks can render SVG diagrams. It uses
// DOMPurify's battle-tested HTML + SVG profiles (correct geometry/presentation
// attributes) while explicitly forbidding the dangerous elements those profiles
// would otherwise allow — same hardening as sanitizeHtmlFragment.
export const sanitizeSvgHtml = (html, loadExternal = true, relaxed = false) =>
  sanitizeExternalRefs(loadExternal, () =>
    DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true, svg: true, svgFilters: true },
      // Relaxed mode allows scripts, and the SAFE_FOR_XML mXSS heuristic
      // force-removes any script/style whose text contains markup-like text
      // (e.g. `</b>` inside a JS template literal), which is normal in
      // interactive documents. The output only ever runs in the sandboxed
      // iframe, so skip that heuristic once the user has opted into scripts.
      SAFE_FOR_XML: !relaxed,
      FORBID_TAGS: relaxed
        ? []
        : [
            "iframe", "object", "embed", "form", "input", "textarea", "select",
            "button", "script", "style", "link", "meta", "base", "math",
            "foreignObject",
          ],
      FORBID_ATTR: relaxed ? [] : ["style"],
      ALLOW_DATA_ATTR: relaxed,
      ADD_TAGS: relaxed ? RELAXED_HTML_TAGS : [],
      ADD_ATTR: relaxed ? RELAXED_HTML_ATTRS : [],
      ALLOW_UNKNOWN_PROTOCOLS: relaxed,
    })
  );

// Strict document policy for the file preview. Unlike the fenced block, a file must keep
// its own stylesheet (DOMPurify would otherwise drop <style>), so this one keeps styles and
// SVG but removes scripts, forms, frames and object embeds. Relaxed mode is deliberately the
// same sanitizer the fenced block uses, so an interactive file behaves like an interactive
// block.
const FORBID_DOCUMENT_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "textarea",
  "select",
  "button",
  "link",
  "meta",
  "base",
  "math",
  "foreignObject",
];

export const sanitizeHtmlDocument = (
  html,
  { relaxed = false, loadExternal = false } = {}
) => {
  const relocated = relocateHeadAssets(String(html ?? ""));
  if (relaxed) return sanitizeSvgHtml(relocated, loadExternal, true);
  return sanitizeExternalRefs(loadExternal, () =>
    DOMPurify.sanitize(relocated, {
      USE_PROFILES: { html: true, svg: true, svgFilters: true },
      FORBID_TAGS: FORBID_DOCUMENT_TAGS,
      ALLOW_DATA_ATTR: false,
    })
  );
};

/* ------------------------------------------------
 * Document helpers
 * ------------------------------------------------ */

// DOMPurify discards <head> content entirely (it only returns body content).
// Well-formed pages put their CSS/JS in <head>, so without this the whole
// stylesheet would be lost. Move <style>, <script> and stylesheet <link>
// elements out of <head> and into <body> so they survive sanitization.
export const relocateHeadAssets = (html) => {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return html;
  const assets = [];
  headMatch[1].replace(
    /<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>|<link\b[^>]*rel=["']stylesheet["'][^>]*\/?>/gi,
    (match) => {
      assets.push(match);
      return "";
    }
  );
  if (!assets.length) return html;
  let result = html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "");
  const closeIdx = result.search(/<\/body>/i);
  const insert = assets.join("\n");
  if (closeIdx !== -1) {
    result = result.slice(0, closeIdx) + insert + "\n" + result.slice(closeIdx);
  } else {
    result = result + insert;
  }
  return result;
};

// <meta http-equiv="refresh"> navigates the frame without a user click and is
// not covered by CSP, so it has to be removed from the sanitized output.
export const stripMetaRefresh = (html) =>
  html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh\b[^>]*>/gi, "");

/* ------------------------------------------------
 * Network policy
 * ------------------------------------------------ */

// Content-Security-Policy for both sandboxed HTML renderers. Attribute filtering
// (sanitizeExternalRefs) cannot stop inline JS from calling fetch()/Image, so
// the browser enforces the network policy as well. The policy is derived from
// the two user settings:
//
//   external references off -> no network at all, only data:/blob: assets
//   relaxed off             -> no scripts, so connect-src can stay 'none'
//   relaxed on              -> inline JS runs, but with external refs off its
//                              fetch/XHR/WebSocket/beacon calls are blocked
//
// `frame-ancestors`, `report-uri` and `report-to` are ignored when a policy is
// delivered through a <meta> tag; do not rely on them here.
export const buildHtmlCsp = ({ relaxed, loadExternal }) => {
  const script = relaxed
    ? loadExternal
      ? "* 'unsafe-inline' 'unsafe-eval'"
      : "'unsafe-inline' 'unsafe-eval'"
    : "'none'";
  const media = loadExternal
    ? "* data: blob:"
    : relaxed
      ? "data: blob:"
      : "data:";
  return [
    "default-src 'none'",
    `script-src ${script}`,
    `connect-src ${relaxed && loadExternal ? "*" : "'none'"}`,
    `img-src ${
      loadExternal ? "* data: blob:" : relaxed ? "data: blob:" : "data:"
    }`,
    `media-src ${media}`,
    `font-src ${loadExternal ? "* data:" : "data:"}`,
    `style-src ${loadExternal ? "* 'unsafe-inline'" : "'unsafe-inline'"}`,
    `object-src ${relaxed && loadExternal ? "*" : "'none'"}`,
    `frame-src ${relaxed && loadExternal ? "*" : "'none'"}`,
    `child-src ${relaxed && loadExternal ? "*" : "'none'"}`,
    `worker-src ${relaxed ? (loadExternal ? "* blob:" : "blob:") : "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
};

export const htmlCspMeta = (csp) =>
  `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
