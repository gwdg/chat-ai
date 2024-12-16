import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import Code from "./Code";

const MarkdownRenderer = React.memo(({ children, isDarkMode }) => {
  if (!children) return null;

  const components = {
    code: ({  inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || "");

      return inline ? (
        <code
          className={`${className} px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-sm`}
          {...props}
        >
          {children}
        </code>
      ) : (
        <Code language={match?.[1]} isDarkMode={isDarkMode}>
          {children}
        </Code>
      );
    },
    h1: (props) => <h1 className="text-2xl font-bold my-4" {...props} />,
    h2: (props) => <h2 className="text-xl font-bold my-3" {...props} />,
    h3: (props) => <h3 className="text-lg font-bold my-2" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic"
        {...props}
      />
    ),
    p: (props) => <p className="my-2" {...props} />,
    ul: (props) => <ul className="list-disc ml-6 my-2" {...props} />,
    ol: (props) => <ol className="list-decimal ml-6 my-2" {...props} />,
    li: (props) => <li className="my-1" {...props} />,
    table: (props) => (
      <div className="overflow-x-auto my-4">
        <table
          className="min-w-full border-collapse border-gray-300 dark:border-gray-600"
          {...props}
        />
      </div>
    ),
    th: (props) => (
      <th
        className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-700"
        {...props}
      />
    ),
    td: (props) => (
      <td
        className="border border-gray-300 dark:border-gray-600 px-4 py-2"
        {...props}
      />
    ),
  };

  return (
    <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
