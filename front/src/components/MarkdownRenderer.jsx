// Importing necessary libraries and components
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import Code from "./Code";
import "highlight.js/styles/github.css";

// MarkdownRenderer component definition
export default function MarkdownRenderer({ children, isDarkMode }) {
  const components = {
    code: Code,
  };

  return (
    <ReactMarkdown
      className={"react-markdown-output " + (isDarkMode ? "dark" : "light")}
      rehypePlugins={[rehypeRaw]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
}
