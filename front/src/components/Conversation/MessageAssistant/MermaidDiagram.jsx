import { useState, useEffect, memo } from "react";
import mermaid from "mermaid";
import DOMPurify from "dompurify";

// Initialize mermaid once
mermaid.initialize({ startOnLoad: false, theme: "forest" });

const MermaidDiagram = memo(({ content }) => {
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
        const cleanSvg = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
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
  }, [content]);

  if (error) {
    return (
      <div className="p-2 text-red-500">
        Failed to render diagram. Showing raw code instead:
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
          {content}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="p-2">Loading diagram...</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
});

MermaidDiagram.displayName = "MermaidDiagram";

export default MermaidDiagram;
