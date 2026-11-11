import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import DOMPurify from "dompurify";
import {
  selectHtmlLoadExternal,
  selectRenderGraphviz,
} from "../../../Redux/reducers/userSettingsReducer";
import { sanitizeExternalRefs } from "../../../utils/externalRefs";
import { grantWasmConsent, useWasmConsent } from "../../../hooks/useWasmConsent";
import Code from "./Code";
import RenderCodeToggle from "./RenderCodeToggle";
import WasmDownloadPrompt from "./WasmDownloadPrompt";

const CACHE_LIMIT = 50;
const GRAPHVIZ_DOWNLOAD_MB = 1.4;
const rawCache = new Map();
let vizPromise;

const loadViz = () => {
  if (!vizPromise) {
    vizPromise = import("@viz-js/viz").then(({ instance }) => instance());
  }
  return vizPromise;
};

const sanitizeGraphvizSvg = (svg, loadExternal) =>
  sanitizeExternalRefs(loadExternal, () =>
    DOMPurify.sanitize(
      String(svg)
        .replace(/^\s*<\?xml[^>]*>\s*/i, "")
        .replace(/^\s*<!DOCTYPE[^>]*>\s*/i, ""),
      {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ["use"],
      }
    )
  );

const GraphvizDiagram = memo(({ content, language = "dot" }) => {
  const { t } = useTranslation();
  const loadExternal = useSelector(selectHtmlLoadExternal);
  const graphvizEnabled = useSelector(selectRenderGraphviz);
  const graphvizConsent = useWasmConsent("graphviz");
  const [showCode, setShowCode] = useState(!graphvizEnabled);
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setShowCode(!graphvizEnabled);
  }, [graphvizEnabled]);

  useEffect(() => {
    if (showCode || !graphvizConsent || !content?.trim()) return;

    const cached = rawCache.get(content);
    if (cached) {
      setSvg(sanitizeGraphvizSvg(cached, loadExternal));
      setError("");
      return;
    }

    let cancelled = false;
    setSvg(null);
    setError("");

    // Let streaming settle instead of layouting a partial DOT graph per chunk.
    const timer = setTimeout(async () => {
      try {
        const viz = await loadViz();
        const result = viz.render(content, { format: "svg", engine: "dot" });
        if (result.status !== "success") {
          throw new Error(
            result.errors?.map((item) => item.message).join("\n") ||
              t("graphviz.render_error")
          );
        }
        rawCache.set(content, result.output);
        if (rawCache.size > CACHE_LIMIT) {
          rawCache.delete(rawCache.keys().next().value);
        }
        if (!cancelled) {
          setSvg(sanitizeGraphvizSvg(result.output, loadExternal));
          setError("");
        }
      } catch (err) {
        console.error("Graphviz rendering error:", err);
        if (!cancelled) setError(err?.message || t("graphviz.render_error"));
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, loadExternal, t, graphvizConsent, showCode]);

  const codeContent = String(content || "").replace(/\n$/, "");
  if (!codeContent.trim()) return null;

  return (
    <div className="relative my-2">
      <RenderCodeToggle
        showCode={showCode}
        onToggle={() => setShowCode((prev) => !prev)}
        renderLabel={t("conversation.graphviz_block.render")}
        showCodeLabel={t("conversation.graphviz_block.show_code")}
      />

      {showCode ? (
        <div className="pt-3">
          <Code language={language}>{codeContent}</Code>
        </div>
      ) : !graphvizConsent ? (
        <WasmDownloadPrompt
          feature={t("wasm_download.feature_graphviz")}
          sizeMb={GRAPHVIZ_DOWNLOAD_MB}
          onConfirm={() => grantWasmConsent("graphviz")}
          onCancel={() => setShowCode(true)}
        />
      ) : error ? (
        <div className="pt-3 p-2 text-error">
          {t("graphviz.render_error")}
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-base-200 p-2 font-mono text-xs">
            {error}
          </pre>
        </div>
      ) : !svg ? (
        <div className="pt-3 p-2 text-base-content/70">{t("graphviz.rendering")}</div>
      ) : (
        <div
          className="graphviz-diagram mt-2 overflow-x-auto rounded-lg bg-base-100 p-4 text-base-content"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
});

GraphvizDiagram.displayName = "GraphvizDiagram";

export default GraphvizDiagram;
