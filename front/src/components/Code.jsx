// Importing necessary libraries and components
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeCopyBtn from "./CodeCopyBtn";

// Code component definition
export default function Code({ inline, className, children, ...props }) {
  const [hovered, setHovered] = useState(false);
  const match = /language-(\w+)/.exec(className || "");

  return !inline && match ? (
    <div
      className="relative block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <SyntaxHighlighter
        style={vscDarkPlus}
        className="custom-syntax-highlighter"
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
      <CodeCopyBtn hovered={hovered}>{children}</CodeCopyBtn>
    </div>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
}
