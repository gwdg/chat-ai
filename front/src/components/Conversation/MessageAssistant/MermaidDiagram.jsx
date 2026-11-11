import { useState, useEffect, memo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import mermaid from "mermaid";
import DOMPurify from "dompurify";
import { selectHtmlLoadExternal } from "../../../Redux/reducers/userSettingsReducer";
import { sanitizeExternalRefs } from "../../../utils/externalRefs";
import { downloadSvg, renderedFilename } from "../../../utils/download";
import RenderToolbar from "./RenderToolbar";

// Initialize mermaid once
mermaid.initialize({ startOnLoad: false, theme: "forest" });

const MermaidDiagram = memo(({ content }) => {
  const { t } = useTranslation();
  const loadExternal = useSelector(selectHtmlLoadExternal);
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!content || !content.trim()) {
      setSvg(null);
      setError(false);
      return;
    }
    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 10)}`;
        // Parse returns true/false; suppress errors keeps console quieter
        const ok = await mermaid.parse(content, { suppressErrors: true });
        if (!ok) {
          if (!cancelled) setError(true);
          return;
        }
        const { svg } = await mermaid.render(id, content);
        if (cancelled) return;
        // Sanitize SVG to avoid injection via <svg> attributes/scripts
        const cleanSvg = sanitizeExternalRefs(loadExternal, () =>
          DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          })
        );
        setSvg(cleanSvg);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        if (!cancelled) setError(true);
      }
    };

    setSvg(null);
    setError(false);
    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [content, loadExternal]);

  if (error) {
    return (
      <div className="p-2 text-error">
        Failed to render diagram. Showing raw code instead:
        <pre className="mt-2 text-xs bg-base-200 p-2 rounded">
          {content}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="p-2">Loading diagram...</div>;
  }

  return (
    <div className="relative my-2">
      <RenderToolbar
        onDownload={() =>
          downloadSvg(svg, renderedFilename("mermaid", "svg"))
        }
        downloadLabel={t("conversation.download_rendered")}
      />
      <div className="pt-3" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
});

MermaidDiagram.displayName = "MermaidDiagram";

export default MermaidDiagram;
