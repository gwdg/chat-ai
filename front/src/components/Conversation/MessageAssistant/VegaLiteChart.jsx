import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  selectHtmlLoadExternal,
  selectRenderVega,
} from "../../../Redux/reducers/userSettingsReducer";
import { isExternalUrl } from "../../../utils/externalRefs";
import Code from "./Code";
import RenderCodeToggle from "./RenderCodeToggle";

const URL_KEYS = new Set(["url", "src", "image", "href"]);
let embedPromise;

const loadVegaEmbed = () => {
  if (!embedPromise) {
    embedPromise = import("vega-embed").then((module) => module.default);
  }
  return embedPromise;
};

const findExternalRef = (value, key = "") => {
  if (URL_KEYS.has(key) && value && typeof value !== "string") {
    // A URL built from a signal is still a URL; block it unless external refs
    // are enabled, because we cannot check its target up front.
    return "[dynamic URL]";
  }
  if (typeof value === "string") {
    return URL_KEYS.has(key) && isExternalUrl(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findExternalRef(item, key);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) {
      const found = findExternalRef(child, childKey);
      if (found) return found;
    }
  }
  return null;
};

const VegaLiteChart = memo(({ content, language = "vega-lite" }) => {
  const { t } = useTranslation();
  const loadExternal = useSelector(selectHtmlLoadExternal);
  const vegaEnabled = useSelector(selectRenderVega);
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [showCode, setShowCode] = useState(!vegaEnabled);
  const [error, setError] = useState("");

  useEffect(() => {
    setShowCode(!vegaEnabled);
  }, [vegaEnabled]);

  useEffect(() => {
    if (showCode) return;
    if (!content || !content.trim()) {
      setError("");
      return;
    }

    let cancelled = false;
    const container = containerRef.current;
    setError("");

    const timer = setTimeout(async () => {
      try {
        const spec = JSON.parse(content);
        const external = findExternalRef(spec);
        if (external && !loadExternal) {
          throw new Error(t("vega.external_blocked", { url: external }));
        }

        const embed = await loadVegaEmbed();
        if (cancelled || !container) return;
        const result = await embed(container, spec, {
          mode: language === "vega" ? "vega" : "vega-lite",
          actions: false,
          tooltip: false,
          renderer: "svg",
          config: { background: "transparent" },
        });
        if (cancelled) {
          result.view?.finalize();
          return;
        }
        viewRef.current = result.view;
      } catch (err) {
        console.error("Vega-Lite rendering error:", err);
        if (!cancelled) {
          setError(err?.message || t("vega.render_error"));
          if (container) container.innerHTML = "";
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      viewRef.current?.finalize();
      viewRef.current = null;
      if (container) container.innerHTML = "";
    };
  }, [content, language, loadExternal, t, showCode]);

  const codeContent = String(content || "").replace(/\n$/, "");
  if (!codeContent.trim()) return null;

  return (
    <div className="relative my-2">
      <RenderCodeToggle
        showCode={showCode}
        onToggle={() => setShowCode((prev) => !prev)}
        renderLabel={t("conversation.vega_block.render")}
        showCodeLabel={t("conversation.vega_block.show_code")}
      />

      {showCode ? (
        <div className="pt-3">
          <Code language={language}>{codeContent}</Code>
        </div>
      ) : error ? (
        <div className="pt-3 p-2 text-error">
          {t("vega.render_error")}
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-base-200 p-2 font-mono text-xs">
            {error}
          </pre>
        </div>
      ) : (
        <div className="vega-chart mt-2 overflow-x-auto rounded-lg bg-base-100 p-2">
          <div ref={containerRef} className="min-h-12 w-full" />
        </div>
      )}
    </div>
  );
});

VegaLiteChart.displayName = "VegaLiteChart";

export default VegaLiteChart;
