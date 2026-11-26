import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { TriangleAlert } from "lucide-react";

import {
  buildHtmlCsp,
  htmlCspMeta,
  sanitizeHtmlDocument,
  stripMetaRefresh,
} from "../../utils/htmlPreview";
import {
  selectHtmlLoadExternal,
  selectHtmlSanitization,
} from "../../Redux/reducers/userSettingsReducer";

/**
 * Renders an HTML document in a sandboxed iframe.
 *
 * The frame always has an opaque origin (no allow-same-origin), so the document can never
 * reach the app. Two modes are offered at the top:
 *
 *  - Strict (default): scripts, forms and frames are removed, the page keeps its own CSS.
 *  - Relaxed: the page also runs its scripts, and the iframe gets `allow-scripts`.
 *
 * The network policy (the CSP delivered as the frame's first <meta>) is the same one the
 * fenced ```html block uses — `utils/htmlPreview.js#buildHtmlCsp` — so external references
 * and network calls follow the same user settings here and there.
 *
 * `relaxedByDefault` and `showModeToggle` exist for course material: its review
 * and self-learning pages build their whole body in JavaScript, so a strict
 * default would render an empty page. They stay sandboxed either way.
 *
 * `heightClass` is the wrapper's height. A page pane fills its parent; a page
 * embedded in a chat reply needs a fixed height instead.
 *
 * `autoHeight` sizes the frame to the document's own content instead: the
 * frame is sandboxed with an opaque origin, so the parent cannot read its
 * size. A small reporter script appended after sanitization measures the body
 * content and posts the height up, and the frame follows it. It only works
 * while the document runs scripts (relaxed), so `heightClass` stays the height
 * until the first measurement and whenever scripts are off.
 */
const HEIGHT_MESSAGE = "chatai-html-preview-height";

// Runs inside the frame. `scrollHeight` cannot be used: it never drops below
// the frame's own viewport, so a page would only ever grow. Measure the bottom
// of the body's in-flow children (fixed bars do not add page height) instead,
// and re-measure on DOM, size and font changes so interactive pages resize.
const heightReporter = () => `<script>
(function () {
  var last = 0;
  var pending = 0;
  function contentHeight() {
    var body = document.body;
    if (!body) return 0;
    var style = window.getComputedStyle(body);
    var scrollY = window.scrollY || 0;
    var bottom = 0;
    var children = body.children;
    for (var i = 0; i < children.length; i += 1) {
      var child = children[i];
      if (window.getComputedStyle(child).position === "fixed") continue;
      var rect = child.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) continue;
      if (rect.bottom + scrollY > bottom) bottom = rect.bottom + scrollY;
    }
    if (!children.length) bottom = body.getBoundingClientRect().bottom + scrollY;
    bottom += parseFloat(style.paddingBottom) || 0;
    bottom += parseFloat(style.marginBottom) || 0;
    return Math.ceil(bottom);
  }
  function report() {
    pending = 0;
    var height = contentHeight();
    if (!height || Math.abs(height - last) < 2) return;
    last = height;
    try {
      window.parent.postMessage({ type: "${HEIGHT_MESSAGE}", height: height }, "*");
    } catch (error) {}
  }
  function schedule() {
    if (pending) return;
    pending = window.requestAnimationFrame
      ? window.requestAnimationFrame(report)
      : window.setTimeout(report, 16);
  }
  var observer = window.ResizeObserver ? new window.ResizeObserver(schedule) : null;
  function observe() {
    if (!observer) return;
    observer.disconnect();
    if (document.documentElement) observer.observe(document.documentElement);
    if (!document.body) return;
    observer.observe(document.body);
    var children = document.body.children;
    for (var i = 0; i < children.length && i < 200; i += 1) {
      observer.observe(children[i]);
    }
  }
  if (window.MutationObserver && document.documentElement) {
    new window.MutationObserver(function () {
      observe();
      schedule();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
  window.addEventListener("load", function () {
    observe();
    schedule();
  });
  window.addEventListener("resize", schedule);
  document.addEventListener("DOMContentLoaded", function () {
    observe();
    schedule();
  });
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(schedule).catch(function () {});
  }
  [0, 120, 500, 1500].forEach(function (delay) {
    window.setTimeout(schedule, delay);
  });
  observe();
  schedule();
})();
</script>`;

// Appended after sanitization. The document has no body tag left at this point
// (DOMPurify returns body content), and a plain append also avoids mistaking a
// literal "</body>" inside the page's own script for the real end of the body.
const withHeightReporter = (html) => `${html}\n${heightReporter()}`;

export default function SandboxedHtmlPreview({
  content,
  title,
  className = "",
  relaxedByDefault = false,
  showModeToggle = true,
  heightClass = "h-full min-h-[70vh]",
  autoHeight = false,
}) {
  const { t } = useTranslation();
  const loadExternal = useSelector(selectHtmlLoadExternal);
  const preferredRelaxed = useSelector(selectHtmlSanitization) === "relaxed";
  const [relaxed, setRelaxed] = useState(relaxedByDefault || preferredRelaxed);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const frameRef = useRef(null);

  // Without scripts the reporter cannot run, so the frame keeps `heightClass`.
  const autoHeightActive = autoHeight && relaxed;

  const srcDoc = useMemo(() => {
    const csp = buildHtmlCsp({ relaxed, loadExternal });
    const html = stripMetaRefresh(
      sanitizeHtmlDocument(content, { relaxed, loadExternal }),
    );
    const body = `${htmlCspMeta(csp)}\n${html}`;
    return autoHeightActive ? withHeightReporter(body) : body;
  }, [content, relaxed, loadExternal, autoHeightActive]);

  useEffect(() => {
    if (!autoHeightActive) {
      setMeasuredHeight(0);
      return undefined;
    }
    // The frame reloads with the new srcDoc, so the old height is stale.
    setMeasuredHeight(0);
    const onMessage = (event) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || data.type !== HEIGHT_MESSAGE) return;
      const height = Math.round(Number(data.height));
      if (!Number.isFinite(height) || height <= 0) return;
      setMeasuredHeight((current) =>
        Math.abs(current - height) < 2 ? current : height,
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [autoHeightActive, srcDoc]);

  const modeClass = (active) =>
    `btn btn-xs join-item ${active ? "btn-active" : "btn-ghost"}`;

  return (
    <div
      className={
        autoHeightActive
          ? "flex flex-col gap-2"
          : `flex flex-col gap-2 ${heightClass}`
      }
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        {relaxed && loadExternal && (
          <span
            className="flex items-center"
            title={t("file_preview.html_relaxed_warning")}
          >
            <TriangleAlert
              className="h-3.5 w-3.5 shrink-0 text-warning"
              aria-label={t("file_preview.html_relaxed_warning")}
            />
          </span>
        )}
        {showModeToggle && (
          <>
            <span className="text-xs text-base-content/60">
              {t("file_preview.html_mode")}
            </span>
            <div
              className="join"
              role="group"
              aria-label={t("file_preview.html_mode")}
            >
              <button
                type="button"
                className={modeClass(!relaxed)}
                aria-pressed={!relaxed}
                onClick={() => setRelaxed(false)}
              >
                {t("file_preview.html_strict")}
              </button>
              <button
                type="button"
                className={modeClass(relaxed)}
                aria-pressed={relaxed}
                title={t("file_preview.html_relaxed_hint")}
                onClick={() => setRelaxed(true)}
              >
                {t("file_preview.html_relaxed")}
              </button>
            </div>
          </>
        )}
      </div>

      <iframe
        ref={frameRef}
        title={title}
        sandbox={relaxed ? "allow-scripts" : ""}
        referrerPolicy="no-referrer"
        allow=""
        srcDoc={srcDoc}
        style={
          autoHeightActive && measuredHeight
            ? { height: measuredHeight }
            : undefined
        }
        className={
          autoHeightActive
            ? `w-full ${measuredHeight ? "" : heightClass} ${className}`
            : `min-h-0 flex-1 ${className}`
        }
      />
    </div>
  );
}
