import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeCopyBtn from "../Others/CodeCopyBtn";

export default function Code({ inline, className, children, ...props }) {
  const [hovered, setHovered] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const isInlineMath = inline && props.node?.type === "inlineMath";
  const isBlockMath = !inline && props.node?.type === "math";

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  // Handle LaTeX math expressions
  if (isInlineMath || isBlockMath) {
    return <span className="math">{children}</span>;
  }

  if (!inline && match) {
    return (
      <div
        className="relative block bg-neutral-800 rounded-lg p-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <SyntaxHighlighter
          style={vscDarkPlus}
          className="custom-syntax-highlighter !bg-transparent"
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children || "").replace(/\n$/, "")}
        </SyntaxHighlighter>
        <CodeCopyBtn hovered={hovered}>{children}</CodeCopyBtn>
      </div>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}
