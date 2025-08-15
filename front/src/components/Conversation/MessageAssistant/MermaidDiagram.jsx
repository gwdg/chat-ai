import { useState, useEffect, memo } from "react";
import mermaid from "mermaid";

// Initialize mermaid
mermaid.initialize({ startOnLoad: false, theme: "forest" });

// MermaidDiagram component
const MermaidDiagram = memo(({ content }) => {
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 10)}`;
        if (await mermaid.parse(content, { suppressErrors: true })) {
          const { svg } = await mermaid.render(id, content);
          setSvg(svg);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(true);
      }
    };

    renderDiagram();
  }, [content]);

  if (error) {
    return <div className="p-2 text-red-500">Failed to render diagram</div>;
  }

  if (!svg) {
    return <div className="p-2">Loading diagram...</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
});

MermaidDiagram.displayName = "MermaidDiagram";

export default MermaidDiagram;
