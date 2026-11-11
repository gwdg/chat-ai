import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Code2, Eye } from "lucide-react";
import DOMPurify from "dompurify";
import compilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import rendererWasmUrl from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";
import { selectRenderTypst } from "../../../Redux/reducers/userSettingsReducer";
import { grantWasmConsent, useWasmConsent } from "../../../hooks/useWasmConsent";
import Code from "./Code";
import WasmDownloadPrompt from "./WasmDownloadPrompt";

const CACHE_LIMIT = 50;
const CROP_PADDING = 6;
// Compiler (28.3 MB), renderer (0.9 MB) and the vendored text fonts (8.3 MB).
const TYPST_DOWNLOAD_MB = 38;
const TYPST_SVG_STYLES =
  "<style>:host{display:block}svg{display:block;max-width:100%;height:auto}</style>";
const svgCache = new Map();

const isPageBackground = (element) => {
  const page = element.closest?.("g.typst-page");
  if (!page) return false;

  const pageWidth = Number(page.getAttribute("data-page-width"));
  const pageHeight = Number(page.getAttribute("data-page-height"));
  if (!pageWidth || !pageHeight) return false;

  let box;
  try {
    box = element.getBBox();
  } catch {
    return false;
  }

  return (
    box.width >= pageWidth * 0.98 && box.height >= pageHeight * 0.98
  );
};

const cropSvgToContent = (container) => {
  const svg = container?.querySelector("svg");
  if (!svg || typeof svg.getBBox !== "function") return;

  // Typst adds a full-page shape for `#set page(fill: ...)` / backgrounds.
  // Exclude those from the content bounds, otherwise nothing is cropped.
  const hiddenBackgrounds = [];
  svg.querySelectorAll("path, rect").forEach((element) => {
    if (!isPageBackground(element)) return;
    hiddenBackgrounds.push([element, element.style.display]);
    element.style.display = "none";
  });

  let box;
  try {
    box = svg.getBBox();
  } catch {
    box = null;
  } finally {
    hiddenBackgrounds.forEach(([element, display]) => {
      element.style.display = display;
    });
  }
  if (!box || (!box.width && !box.height)) return;

  const x = box.x - CROP_PADDING;
  const y = box.y - CROP_PADDING;
  const width = box.width + CROP_PADDING * 2;
  const height = box.height + CROP_PADDING * 2;

  if (hiddenBackgrounds.length) {
    svg.style.overflow = "hidden";
  }

  svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
};

let typstPromise;
let renderQueue = Promise.resolve();

const TYPST_ASSET_PREFIX = `${import.meta.env.BASE_URL}typst-assets/`;

const loadTypst = () => {
  if (!typstPromise) {
    typstPromise = import("@myriaddreamin/typst.ts").then(
      ({ $typst, loadFonts }) => {
        $typst.setCompilerInitOptions({
          getModule: () => compilerWasmUrl,
          // Serve Typst's default fonts from our own origin instead of the
          // jsDelivr CDN the library falls back to. `assets` must be set here,
          // otherwise typst.ts adds its own default remote loader as well.
          beforeBuild: [
            loadFonts([], {
              assets: ["text"],
              assetUrlPrefix: TYPST_ASSET_PREFIX,
            }),
          ],
        });
        $typst.setRendererInitOptions({ getModule: () => rendererWasmUrl });
        return $typst;
      }
    );
  }
  return typstPromise;
};

const compileTypst = (content) => {
  const render = async () => {
    const $typst = await loadTypst();
    return $typst.svg({
      mainContent: content,
      data_selection: { body: true, defs: true, css: true, js: false },
    });
  };

  const result = renderQueue.then(render, render);
  renderQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

const TypstBlock = memo(
  ({ content, language = "typst", defaultRender = true }) => {
    const { t } = useTranslation();
    const renderTypst = useSelector(selectRenderTypst);
    const typstConsent = useWasmConsent("typst");
    const [showCode, setShowCode] = useState(!(defaultRender && renderTypst));
    const [svg, setSvg] = useState(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const contentRef = useRef(null);

    useLayoutEffect(() => {
      const host = contentRef.current;
      if (!host || !svg || showCode) return;

      // Typst's SVG contains a global <style> (notably `svg { fill: none }`).
      // Keep it in a shadow root so it cannot restyle the app's own SVG icons.
      const root = host.shadowRoot || host.attachShadow({ mode: "open" });
      root.innerHTML = `${TYPST_SVG_STYLES}${svg}`;
      cropSvgToContent(root);
    }, [svg, showCode]);

    useEffect(() => {
      setShowCode(!(defaultRender && renderTypst));
    }, [defaultRender, renderTypst]);

    useEffect(() => {
      if (showCode) {
        setLoading(false);
        return;
      }

      if (!content || !content.trim()) {
        setSvg(null);
        setError(false);
        setLoading(false);
        return;
      }

      const cached = svgCache.get(content);
      if (cached) {
        setSvg(cached);
        setError(false);
        setLoading(false);
        return;
      }

      if (!typstConsent) {
        setSvg(null);
        setError(false);
        setLoading(false);
        return;
      }

      let cancelled = false;
      setLoading(true);
      setError(false);

      const timer = setTimeout(async () => {
        try {
          const rawSvg = await compileTypst(content);
          if (cancelled) return;

          const cleanSvg = DOMPurify.sanitize(rawSvg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ["use"],
          });

          svgCache.set(content, cleanSvg);
          if (svgCache.size > CACHE_LIMIT) {
            svgCache.delete(svgCache.keys().next().value);
          }

          setSvg(cleanSvg);
          setLoading(false);
        } catch (err) {
          console.error("Typst rendering error:", err);
          if (cancelled) return;
          setError(true);
          setLoading(false);
        }
      }, 400);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [content, showCode, typstConsent]);

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
              {t("conversation.typst_block.render")}
            </>
          ) : (
            <>
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("conversation.typst_block.show_code")}
            </>
          )}
        </button>

        {showCode ? (
          <div className="pt-3">
            <Code language={language}>{codeContent}</Code>
          </div>
        ) : !typstConsent && codeContent.trim() ? (
          <WasmDownloadPrompt
            feature={t("wasm_download.feature_typst")}
            sizeMb={TYPST_DOWNLOAD_MB}
            onConfirm={() => grantWasmConsent("typst")}
            onCancel={() => setShowCode(true)}
          />
        ) : error ? (
          <div className="pt-3 p-2 text-error">
            {t("typst.render_error")}
            <pre className="mt-2 text-xs bg-base-200 p-2 rounded overflow-x-auto">
              {codeContent}
            </pre>
          </div>
        ) : loading && !svg ? (
          <div className="pt-3 p-2">{t("typst.rendering")}</div>
        ) : svg ? (
          <div className="mt-2 overflow-x-auto rounded-lg bg-base-100 p-4 text-base-content">
            <div ref={contentRef} className="typst-document block w-full" />
          </div>
        ) : (
          <div className="pt-3" />
        )}
      </div>
    );
  }
);

TypstBlock.displayName = "TypstBlock";

export default TypstBlock;
