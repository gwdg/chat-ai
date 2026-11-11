import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Code2, Eye } from "lucide-react";
import DOMPurify from "dompurify";
import latexWasmUrl from "faster-latex-wasm?url";
import { selectRenderLatex } from "../../../Redux/reducers/userSettingsReducer";
import { grantWasmConsent, useWasmConsent } from "../../../hooks/useWasmConsent";
import Code from "./Code";
import WasmDownloadPrompt from "./WasmDownloadPrompt";
import { extractTikz, renderTikzSnippets } from "./tikzRenderer";

const CACHE_LIMIT = 50;
// faster-latex WASM (~0.4 MB); TikZJax adds its engine, fonts and CSS (~6.8 MB).
const LATEX_DOWNLOAD_MB = 0.4;
const TIKZ_DOWNLOAD_MB = 6.8;
const htmlCache = new Map();

const EXTRA_CSS = `
.fl-article {
  max-width: 100%;
  margin: 0;
  padding: 0;
  color: #1a1a1a;
}
.fl-verbatim { background: #f6f8fa; border-color: #ddd; }
.fl-toc { background: #fafafa; border-color: #eee; }
.fl-date, .fl-secnum, .fl-caption, .fl-quote, .fl-quotation, .fl-toc-num {
  color: #555;
}
.fl-ref, .fl-cite a, .fl-toc a { color: #0b5cad; }
.latex-tikz {
  display: inline-block;
  max-width: 100%;
  vertical-align: middle;
}
.latex-tikz svg {
  display: inline-block;
  max-width: 100%;
  height: auto;
}
`;

let latexPromise;

const loadLatex = () => {
  if (!latexPromise) {
    latexPromise = import("faster-latex/web")
      .then(async (mod) => {
        await mod.default({ module_or_path: latexWasmUrl });
        return { render: mod.render, css: mod.article_css() };
      })
      .catch((err) => {
        latexPromise = undefined;
        throw err;
      });
  }
  return latexPromise;
};

const renderLatex = async (source) => {
  const cached = htmlCache.get(source);
  if (cached) return cached;

  const { cleanedSource, snippets, libraries, packages, preamble } =
    extractTikz(source);

  const [{ render, css }, svgs] = await Promise.all([
    loadLatex(),
    renderTikzSnippets(snippets, { libraries, packages, preamble }),
  ]);

  const result = render(cleanedSource, { fullDocument: false });

  if (result.warnings?.length) {
    console.warn("LaTeX rendering warnings:", result.warnings);
  }

  let html = result.html;
  snippets.forEach((snippet, index) => {
    html = html
      .split(snippet.token)
      .join(`<span class="latex-tikz">${svgs[index]}</span>`);
  });

  html = DOMPurify.sanitize(html, {
    USE_PROFILES: {
      html: true,
      svg: true,
      svgFilters: true,
      mathMl: true,
    },
    ADD_TAGS: ["use"],
  });

  const output = { html, css };
  htmlCache.set(source, output);
  if (htmlCache.size > CACHE_LIMIT) {
    htmlCache.delete(htmlCache.keys().next().value);
  }
  return output;
};

const LatexBlock = memo(
  ({ content, language = "latex", defaultRender = true }) => {
    const { t } = useTranslation();
    const renderLatexEnabled = useSelector(selectRenderLatex);
    const latexConsent = useWasmConsent("latex");
    const tikzConsent = useWasmConsent("tikz");
    const tikzNeeded = useMemo(
      () => extractTikz(String(content || "")).snippets.length > 0,
      [content]
    );
    const hasRequiredConsent = latexConsent && (!tikzNeeded || tikzConsent);
    const consentSizeMb =
      (!latexConsent ? LATEX_DOWNLOAD_MB : 0) +
      (tikzNeeded && !tikzConsent ? TIKZ_DOWNLOAD_MB : 0);
    const consentFeature =
      !latexConsent && (!tikzNeeded || tikzConsent)
        ? t("wasm_download.feature_latex")
        : !latexConsent
          ? `${t("wasm_download.feature_latex")} + ${t("wasm_download.feature_tikz")}`
          : t("wasm_download.feature_tikz");
    const [showCode, setShowCode] = useState(
      !(defaultRender && renderLatexEnabled)
    );
    const [output, setOutput] = useState(null);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const contentRef = useRef(null);

    useLayoutEffect(() => {
      const host = contentRef.current;
      if (!host || !output || showCode) return;

      // The shipped stylesheet must not leak into the app, so keep both the
      // rendered document and its CSS inside a shadow root.
      const root = host.shadowRoot || host.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${output.css}${EXTRA_CSS}</style>${output.html}`;
    }, [output, showCode]);

    useEffect(() => {
      setShowCode(!(defaultRender && renderLatexEnabled));
    }, [defaultRender, renderLatexEnabled]);

    useEffect(() => {
      if (showCode) {
        setLoading(false);
        return;
      }

      if (!content || !content.trim()) {
        setOutput(null);
        setError(false);
        setErrorMessage("");
        setLoading(false);
        return;
      }

      const cached = htmlCache.get(content);
      if (cached) {
        setOutput(cached);
        setError(false);
        setErrorMessage("");
        setLoading(false);
        return;
      }

      if (!hasRequiredConsent) {
        setOutput(null);
        setError(false);
        setErrorMessage("");
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);
      setError(false);
      setErrorMessage("");

      const timer = setTimeout(async () => {
        try {
          const rendered = await renderLatex(content);
          if (cancelled) return;
          setOutput(rendered);
          setLoading(false);
        } catch (err) {
          console.error("LaTeX rendering error:", err);
          if (cancelled) return;
          setErrorMessage(err?.message || String(err));
          setError(true);
          setLoading(false);
        }
      }, 400);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [content, showCode, hasRequiredConsent]);

    const codeContent = String(content || "").replace(/\n$/, "");

    return (
      <div className="relative my-2">
        <button
          type="button"
          onClick={() => setShowCode((prev) => !prev)}
          aria-pressed={showCode}
          className="absolute -top-3 right-2 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-base-300 bg-base-100 px-2 py-1 text-[11px] font-medium text-base-content/70 shadow-sm transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {showCode ? (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {t("conversation.latex_block.render")}
            </>
          ) : (
            <>
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("conversation.latex_block.show_code")}
            </>
          )}
        </button>

        {showCode ? (
          <div className="pt-3">
            <Code language={language}>{codeContent}</Code>
          </div>
        ) : !hasRequiredConsent && codeContent.trim() ? (
          <WasmDownloadPrompt
            feature={consentFeature}
            sizeMb={consentSizeMb}
            onConfirm={() =>
              grantWasmConsent("latex", ...(tikzNeeded ? ["tikz"] : []))
            }
            onCancel={() => setShowCode(true)}
          />
        ) : error ? (
          <div className="pt-3 p-2 text-error">
            {t("latex.render_error")}
            {errorMessage && (
              <div className="mt-1 font-mono text-xs break-words">
                {errorMessage}
              </div>
            )}
            <pre className="mt-2 text-xs bg-base-200 p-2 rounded overflow-x-auto">
              {codeContent}
            </pre>
          </div>
        ) : loading && !output ? (
          <div className="pt-3 p-2">{t("latex.rendering")}</div>
        ) : output ? (
          <div className="mt-2 overflow-x-auto rounded-lg bg-base-100 p-4 text-base-content">
            <div ref={contentRef} className="latex-document block w-full" />
          </div>
        ) : (
          <div className="pt-3" />
        )}
      </div>
    );
  }
);

LatexBlock.displayName = "LatexBlock";

export default LatexBlock;
