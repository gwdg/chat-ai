import { useMemo } from "react";
import DOMPurify from "dompurify";

import { sanitizeExternalRefs } from "../../utils/externalRefs";

// Strict preview policy: no scripts, no network, no embedded frames or objects. Inline styles are
// kept so the document still looks like the original, but external URLs are stripped and the CSP
// blocks any remaining request (including CSS image/font loads).
const CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "style-src 'unsafe-inline'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;

const FORBID_TAGS = [
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

// DOMPurify discards <head>. Move styles out of it so the preview keeps its appearance; scripts
// are removed by the sanitizer anyway.
const relocateHeadAssets = (html) => {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return html;
  const assets = [];
  headMatch[1].replace(
    /<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>|<link\b[^>]*rel=["']stylesheet["'][^>]*\/?>/gi,
    (match) => {
      assets.push(match);
      return "";
    },
  );
  if (!assets.length) return html;
  let result = html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "");
  const closeIdx = result.search(/<\/body>/i);
  if (closeIdx !== -1) {
    result =
      result.slice(0, closeIdx) + assets.join("\n") + "\n" + result.slice(closeIdx);
  } else {
    result += assets.join("\n");
  }
  return result;
};

// <meta http-equiv="refresh"> navigates the frame without a user click and is not covered by CSP.
const stripMetaRefresh = (html) =>
  html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh\b[^>]*>/gi, "");

const sanitize = (html) =>
  sanitizeExternalRefs(false, () =>
    DOMPurify.sanitize(relocateHeadAssets(html), {
      USE_PROFILES: { html: true, svg: true, svgFilters: true },
      FORBID_TAGS,
      ALLOW_DATA_ATTR: false,
    }),
  );

export default function SandboxedHtmlPreview({
  content,
  title,
  className = "",
}) {
  const srcDoc = useMemo(
    () => `${CSP_META}\n${stripMetaRefresh(sanitize(String(content ?? "")))}`,
    [content],
  );

  return (
    <iframe
      title={title}
      sandbox=""
      referrerPolicy="no-referrer"
      allow=""
      srcDoc={srcDoc}
      className={className}
    />
  );
}
