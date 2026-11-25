import { useMemo, useState } from "react";
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
 */
export default function SandboxedHtmlPreview({
  content,
  title,
  className = "",
}) {
  const { t } = useTranslation();
  const loadExternal = useSelector(selectHtmlLoadExternal);
  const defaultRelaxed = useSelector(selectHtmlSanitization) === "relaxed";
  const [relaxed, setRelaxed] = useState(defaultRelaxed);

  const srcDoc = useMemo(() => {
    const csp = buildHtmlCsp({ relaxed, loadExternal });
    const html = stripMetaRefresh(
      sanitizeHtmlDocument(content, { relaxed, loadExternal }),
    );
    return `${htmlCspMeta(csp)}\n${html}`;
  }, [content, relaxed, loadExternal]);

  const modeClass = (active) =>
    `btn btn-xs join-item ${active ? "btn-active" : "btn-ghost"}`;

  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-2">
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
      </div>

      <iframe
        title={title}
        sandbox={relaxed ? "allow-scripts" : ""}
        referrerPolicy="no-referrer"
        allow=""
        srcDoc={srcDoc}
        className={`min-h-0 flex-1 ${className}`}
      />
    </div>
  );
}
