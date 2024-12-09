import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import Code from "./Code";

const MarkdownRenderer = ({ children, isDarkMode }) => {
  const components = {
    code: Code,
    h1: (props) => <h1 className="text-2xl font-bold my-4" {...props} />,
    h2: (props) => <h2 className="text-xl font-bold my-3" {...props} />,
    h3: (props) => <h3 className="text-lg font-bold my-2" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic"
        {...props}
      />
    ),
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
    a: (props) => (
      <a
        className="text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
  };

  return (
    <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
      <ReactMarkdown
        className="react-markdown-output"
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={components}
      >
        {children ?? ""}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
