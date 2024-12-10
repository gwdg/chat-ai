import { useState, useCallback, memo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeCopyBtn from "../Others/CodeCopyBtn";

const Code = memo(({ inline, className, children, ...props }) => {
  const [hovered, setHovered] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const isInlineMath = inline && props.node?.type === "inlineMath";
  const isBlockMath = !inline && props.node?.type === "math";

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  // Safeguard against undefined children
  const content = children || "";

  // Handle LaTeX math expressions
  if (isInlineMath || isBlockMath) {
    return (
      <span className="math px-1 py-0.5 my-2 block overflow-x-auto">
        {content}
      </span>
    );
  }

  // Handle inline code
  if (inline) {
    return (
      <code
        className={`${className} px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-sm`}
      >
        {content}
      </code>
    );
  }

  // Handle code blocks
  if (match) {
    return (
      <div
        className="relative block bg-neutral-800 rounded-lg p-1 my-4"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <SyntaxHighlighter
          style={vscDarkPlus}
          className="custom-syntax-highlighter !bg-transparent"
          language={match[1]}
          PreTag="div"
          wrapLines={true}
          wrapLongLines={true}
          {...props}
        >
          {String(content).replace(/\n$/, "")}
        </SyntaxHighlighter>
        <CodeCopyBtn hovered={hovered}>{content}</CodeCopyBtn>
      </div>
    );
  }

  // Fallback for any other code elements
  return (
    <code className={`${className} font-mono text-sm`} {...props}>
      {content}
    </code>
  );
});

Code.displayName = "Code";

export default Code;
