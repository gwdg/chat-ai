import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import compilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import rendererWasmUrl from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";
import { grantWasmConsent, useWasmConsent } from "../../../hooks/useWasmConsent";
import {
  collectTypstFiles,
  typstSignature,
} from "../../../utils/typstFiles";
import ZoomControls, { useZoom } from "../../DocumentPanel/ZoomControls";
import WasmDownloadPrompt from "./WasmDownloadPrompt";

const CACHE_LIMIT = 50;
const CROP_PADDING = 6;
// The document is mounted at a fixed path so one compile root can be kept for
// every host. `$typst.svg({ mainContent })` would instead mount it under
// `/tmp/<random>.typ`, making `/tmp` the root: every `#include`, `#image` and
// `#bibliography` in the document then failed with "cannot read file outside of
// project root".
const MAIN_PATH = "/main.typ";
const TYPST_ROOT = "/";
// Compiler (28.3 MB), renderer (0.9 MB) and the vendored text fonts (8.3 MB).
export const TYPST_DOWNLOAD_MB = 38;
const TYPST_SVG_STYLES =
  "<style>:host{display:block}svg{display:block;max-width:100%;height:auto}</style>";

// A zoomed document is reflowed rather than transformed: the SVG's own width
// grows with the factor, so the pane gets real scrollbars and Typst's vector
// output stays sharp (a transform would paint outside the layout box and clip
// everything beside the top-left corner). At 100 % the original rule is kept, so
// a narrow document is not stretched to the pane.
const typstSvgStyles = (scale) =>
  scale === 1
    ? TYPST_SVG_STYLES
    : `<style>:host{display:block}svg{display:block;width:${scale * 100}%;max-width:none;height:auto}</style>`;
// Shared by every host: two Typst blocks with the same source, and a workspace
// file that shows the same document, compile once.
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
// Shadow paths mounted by the last compile. Compiles are serialised, so the
// previous document's files are removed before the next one is mounted.
let mountedPaths = [];

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

const unmountFiles = async ($typst) => {
  const paths = mountedPaths;
  mountedPaths = [];
  for (const path of paths) {
    try {
      await $typst.unmapShadow(path);
    } catch {
      // A path the compiler already dropped needs no cleanup.
    }
  }
};

const compileTypst = (content, files = []) => {
  const render = async () => {
    const $typst = await loadTypst();
    await unmountFiles($typst);
    try {
      // The main file and everything it loads live in one virtual tree rooted at
      // `/`, so a reference resolves regardless of where the host keeps the file.
      await $typst.addSource(MAIN_PATH, content);
      mountedPaths.push(MAIN_PATH);
      for (const file of files) {
        await $typst.mapShadow(file.path, file.data);
        mountedPaths.push(file.path);
      }
      const vectorData = await $typst.vector({
        mainFilePath: MAIN_PATH,
        root: TYPST_ROOT,
        diagnostics: "none",
      });
      // Rendering from the artifact keeps the file set out of the renderer, which
      // never sees the compiler's shadow files.
      return $typst.svg({
        vectorData,
        data_selection: { body: true, defs: true, css: true, js: false },
      });
    } finally {
      await unmountFiles($typst);
    }
  };

  const result = renderQueue.then(render, render);
  renderQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

/**
 * Compiles one Typst source into sanitised SVG and keeps the consent, loading
 * and error state that goes with it.
 *
 * `enabled` is the host's own switch (a fenced block's "Render as Typst", a file
 * preview's Render button). Turning it off keeps the last SVG, so Download keeps
 * working and re-enabling is instant. The renderer is a shared, stateful instance
 * and a ~28 MB WASM download, so compiling waits for the user's `typst` consent
 * and is debounced and serialised here rather than per component.
 *
 * `resolveFile` is what a workspace preview passes: a document can `#include` or
 * `#image` its siblings, and they have to be read before the synchronous
 * compiler asks for them. Without it the source is all there is, which is what a
 * fenced block in a chat message has.
 */
export function useTypstDocument(content, enabled, resolveFile) {
  const typstConsent = useWasmConsent("typst");
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState([]);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (!content || !content.trim()) {
      setSvg(null);
      setError(false);
      setLoading(false);
      setMissing([]);
      setTruncated(false);
      return;
    }

    // With no files to load the cache key is the source itself, so a repeat
    // render is instant. A document that reads siblings changes with them, and
    // only a read can tell.
    if (!resolveFile) {
      const inlineCached = svgCache.get(content);
      if (inlineCached) {
        setSvg(inlineCached);
        setError(false);
        setLoading(false);
        return;
      }
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
    setMissing([]);
    setTruncated(false);

    // A workspace preview re-renders while its editor is typed into, so every
    // host debounces: a burst of keystrokes is one compile, not one per key.
    const timer = setTimeout(
      async () => {
        try {
          const collected = await collectTypstFiles(content, { resolveFile });
          if (cancelled) return;
          setMissing(collected.missing);
          setTruncated(collected.truncated);

          const signature = typstSignature(content, collected.files);
          const cached = svgCache.get(signature);
          if (cached) {
            setSvg(cached);
            setLoading(false);
            return;
          }

          const rawSvg = await compileTypst(content, collected.files);
          if (cancelled) return;

          const cleanSvg = DOMPurify.sanitize(rawSvg, {
            USE_PROFILES: { svg: true, svgFilters: true },
            ADD_TAGS: ["use"],
          });

          svgCache.set(signature, cleanSvg);
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
      },
      400,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, enabled, typstConsent, resolveFile]);

  return { svg, loading, error, consent: typstConsent, missing, truncated };
}

/**
 * The rendered document. Typst's SVG carries its own global `<style>` (notably
 * `svg { fill: none }`), so it lives in a shadow root and cannot restyle the
 * app's own icons.
 */
export function TypstDocumentView({ svg, scale = 1 }) {
  const hostRef = useRef(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !svg) return;
    const root = host.shadowRoot || host.attachShadow({ mode: "open" });
    root.innerHTML = `${typstSvgStyles(scale)}${svg}`;
    cropSvgToContent(root);
  }, [svg, scale]);

  return <div ref={hostRef} className="typst-document block w-full" />;
}

/**
 * A rendered document with an optional zoom bar. The Typst SVG is cropped to its
 * content and scales as a vector, so the zoom re-sizes it instead of painting it
 * out of the layout box: the pane then scrolls to the whole document.
 */
export function TypstRendered({ svg, zoomable = false }) {
  const { zoom, zoomIn, zoomOut, reset } = useZoom();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {zoomable && (
        <div className="mb-1 flex shrink-0 justify-end">
          <ZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-base-100 p-4 text-base-content">
        <div data-testid="typst-zoom-content">
          <TypstDocumentView svg={svg} scale={zoom} />
        </div>
      </div>
    </div>
  );
}

/**
 * A whole Typst document with its consent prompt, spinner and error fallback —
 * what a host that has no code view of its own (a workspace file preview) shows
 * while the user asked for it.
 */
export default function TypstDocument({
  content,
  resolveFile,
  onDecline,
  zoomable = false,
}) {
  const { t } = useTranslation();
  const { svg, loading, error, consent, missing, truncated } =
    useTypstDocument(content, true, resolveFile);
  const codeContent = String(content || "").replace(/\n$/, "");

  if (!consent && codeContent.trim()) {
    return (
      <WasmDownloadPrompt
        feature={t("wasm_download.feature_typst")}
        sizeMb={TYPST_DOWNLOAD_MB}
        onConfirm={() => grantWasmConsent("typst")}
        onCancel={onDecline}
      />
    );
  }

  if (error) {
    return (
      <div className="p-2 text-error">
        {t("typst.render_error")}
        {missing.length > 0 && (
          <p className="mt-1 text-xs" data-guide="typst-missing-files">
            {t("typst.missing_files", { files: missing.join(", ") })}
          </p>
        )}
        {truncated && (
          <p className="mt-1 text-xs">{t("typst.files_truncated")}</p>
        )}
        <pre className="mt-2 overflow-x-auto rounded bg-base-200 p-2 text-xs">
          {codeContent}
        </pre>
      </div>
    );
  }

  if (loading && !svg) {
    return <div className="p-2">{t("typst.rendering")}</div>;
  }

  if (svg) {
    return <TypstRendered svg={svg} zoomable={zoomable} />;
  }

  return null;
}
