import Code from "./Code";
import MermaidDiagram from "./MermaidDiagram";
import React from "react";

const flattenToText = (nodes) => {
  const arr = React.Children.toArray(nodes);
  const parts = arr.map((child) => {
    if (typeof child === "string" || typeof child === "number")
      return String(child);
    if (React.isValidElement(child))
      return flattenToText(child.props?.children ?? "");
    return ""; // ignore booleans/objects/comments
  });
  return parts.join("");
};

const extractTextFromHast = (node) => {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  if (Array.isArray(node.children))
    return node.children.map(extractTextFromHast).join("");
  return "";
};

const inferLanguage = (className, node) => {
  const m = /language-([\w+-]+)/.exec(className || "");
  if (m?.[1]) return m[1]; // fenced code

  // <code bash> ... </code>
  const props = node?.properties || {};
  const candidate = Object.keys(props).find((k) => {
    if (k === "className") return false;
    const v = props[k];
    return v === "" || v === true;
  });
  if (candidate && /^[a-z][\w+-]*$/i.test(candidate))
    return candidate.toLowerCase();

  return null;
};

// Custom renderer components
export const rendererComponents = {
  code({ className, children, node, inline }) {
    let content = flattenToText(children);

    // fallback to HAST text if needed
    if (!content || /\[object Object\]/.test(content) || /^,+$/.test(content)) {
      const hastText = extractTextFromHast(node);
      if (hastText) content = hastText;
    }

    content = (content || "")
      .replace(/\[object Object\]/g, "")
      .replace(/(^|,)\s*,+/g, "$1") // strip stray commas
      .replace(/\n$/, "")
      .trim();

    const language = inferLanguage(className, node);

    const isBlock =
      node?.parent?.tagName === "pre" ||
      (!inline && (content.includes("\n") || content.length > 80));

    if (!isBlock) {
      // inline
      if (!content) return null;
      return (
        <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-xs">
          {content}
        </code>
      );
    }

    // block
    if ((language || "").toLowerCase() === "mermaid") {
      return <MermaidDiagram content={content} />;
    }
    if (!content) return null;
    return <Code language={language || "text"}>{content}</Code>;
  },

  // keep your existing components below
  pre({ children, ...props }) {
    return <pre {...props}>{children}</pre>;
  },
  p: ({ children }) => <div className="text-sm">{children}</div>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors text-sm"
    >
      {children}
    </a>
  ),
  h1: ({ children, id }) => (
    <h1
      className="text-xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h1>
  ),
  h2: ({ children, id }) => (
    <h2
      className="text-lg font-semibold mt-5 mb-3 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3
      className="text-base font-medium mt-4 mb-2 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4
      className="text-sm font-medium mt-3 mb-2 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h4>
  ),
  h5: ({ children, id }) => (
    <h5
      className="text-xs font-medium mt-2 mb-1 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h5>
  ),
  h6: ({ children, id }) => (
    <h6
      className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1"
      id={id}
    >
      {children}
    </h6>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-gray-900 dark:text-gray-100 text-sm">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-800 dark:text-gray-200 text-sm">
      {children}
    </em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1 text-sm">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-800 dark:text-gray-200 text-sm">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-r text-sm">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="w-full overflow-x-auto my-4">
      <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="bg-white dark:bg-gray-900">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 text-sm">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-gray-800 dark:text-gray-200 text-sm">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="border-t border-gray-300 dark:border-gray-700 my-6" />
  ),
  // Add support for math components if using remark-math
  math: ({ value }) => (
    <div className="my-4 text-center">
      <span className="katex-display">{value}</span>
    </div>
  ),
  inlineMath: ({ value }) => <span className="katex">{value}</span>,
};
