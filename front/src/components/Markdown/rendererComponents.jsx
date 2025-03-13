import Code from "./Code";
import MermaidDiagram from "./MermaidDiagram";

// Custom renderer components
export const rendererComponents = {
  code({ inline, className, children }) {
    const match = /language-(\w+)/.exec(className || "");
    const content = String(children).replace(/\n$/, "");

    if (inline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-sm">
          {content}
        </code>
      );
    }

    // Handle mermaid diagrams
    if (match && match[1] === "mermaid") {
      return <MermaidDiagram content={content} />;
    }

    // Use the dedicated Code component for code blocks
    return <Code language={match ? match[1] : null}>{content}</Code>;
  },
  p: ({ children }) => <p className="mb-3">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-500 underline"
    >
      {children}
    </a>
  ),
  h1: ({ children, id }) => (
    <h1 className="text-2xl font-bold mt-4" id={id}>
      {children}
    </h1>
  ),
  h2: ({ children, id }) => (
    <h2 className="text-xl font-semibold mt-3" id={id}>
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3 className="text-lg font-medium mt-2" id={id}>
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4 className="text-md font-medium mt-1" id={id}>
      {children}
    </h4>
  ),
  h5: ({ children, id }) => (
    <h5 className="text-sm font-medium" id={id}>
      {children}
    </h5>
  ),
  h6: ({ children, id }) => (
    <h6 className="text-xs font-medium text-gray-600" id={id}>
      {children}
    </h6>
  ),
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 pl-4 italic text-gray-600">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="w-full overflow-x-auto my-4">
      <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
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
    <tr className="border-b border-gray-300 dark:border-gray-700">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
      {children}
    </td>
  ),
};
