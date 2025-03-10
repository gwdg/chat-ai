import { useState, useEffect, useRef, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { MathJaxContext, MathJax } from "better-react-mathjax";
import mermaid from "mermaid";
import Code from "./Code";
import ThinkingBlock from "./ThinkingBlock";
import ReferencesSection from "./ReferencesSection";

// Initialize mermaid
mermaid.initialize({ startOnLoad: false, theme: "forest" });

// MathJax configuration
const mathJaxConfig = {
  loader: { load: ["[tex]/html"] },
  tex: {
    packages: { "[+]": ["html"] },
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ],
  },
  startup: {
    typeset: false,
  },
};

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

// Helper function to convert inline LaTeX to a form MathJax can recognize directly
const convertInlineLatex = (text) => {
  if (!text) return text;

  // Replace the \( ... \) LaTeX notation to ensure it's properly processed
  return text.replace(/\\[(]([^)]+)\\[)]/g, (match, latex) => {
    return `$${latex}$`;
  });
};

// Pre-process content to handle special LaTeX format [f(x) = ...]
const preprocessContent = (content) => {
  if (!content) return content;

  let processedContent = content;

  // Convert \( ... \) to $...$ for better compatibility
  processedContent = convertInlineLatex(processedContent);

  // Match formula patterns like [f(x) = ...] or similar mathematical expressions in square brackets
  const squareBracketFormulaRegex =
    /\[(f\(x\)|f\([^\)]+\))[^=\n]*=\s*[\s\S]*?\]/g;

  // Replace square bracket formulas with standard LaTeX display mode
  processedContent = processedContent.replace(
    squareBracketFormulaRegex,
    (match) => {
      // Remove the square brackets
      const formula = match.substring(1, match.length - 1);
      // Wrap with standard LaTeX delimiters
      return `$$${formula}$$`;
    }
  );

  // Handle other special cases of square brackets containing LaTeX-like content
  const latexInSquareBracketsRegex =
    /\[[^\]]*\\(?:frac|sigma|mu|pi|sum|int|alpha|beta|gamma)[^\]]*\]/g;

  processedContent = processedContent.replace(
    latexInSquareBracketsRegex,
    (match) => {
      // Remove the square brackets
      const formula = match.substring(1, match.length - 1);
      // Wrap with standard LaTeX delimiters
      return `$$${formula}$$`;
    }
  );

  return processedContent;
};

// Define a custom MathJax-enabled component for each markdown element
const createMathComponent = (Component) => {
  return ({ children, ...props }) => {
    return (
      <MathJax>
        <Component {...props}>{children}</Component>
      </MathJax>
    );
  };
};

// Markdown component renderers
export const rendererComponents = {
  code: ({ inline, className, children }) => {
    const match = /language-(\w+)/.exec(className || "");
    const content = String(children).replace(/\n$/, "");

    if (inline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-sm">
          {content}
        </code>
      );
    }

    if (match && match[1] === "mermaid") {
      return <MermaidDiagram content={content} />;
    }

    return <Code language={match?.[1]}>{content}</Code>;
  },
  a: ({ href, children }) => (
    <MathJax>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-blue-500 underline"
      >
        {children}
      </a>
    </MathJax>
  ),
  p: ({ children }) => (
    <MathJax>
      <p className="mb-3">{children}</p>
    </MathJax>
  ),
  h1: ({ children, id }) => (
    <MathJax>
      <h1 className="text-2xl font-bold mt-4" id={id}>
        {children}
      </h1>
    </MathJax>
  ),
  h2: ({ children, id }) => (
    <MathJax>
      <h2 className="text-xl font-semibold mt-3" id={id}>
        {children}
      </h2>
    </MathJax>
  ),
  h3: ({ children, id }) => (
    <MathJax>
      <h3 className="text-lg font-medium mt-2" id={id}>
        {children}
      </h3>
    </MathJax>
  ),
  h4: ({ children, id }) => (
    <MathJax>
      <h4 className="text-md font-medium mt-1" id={id}>
        {children}
      </h4>
    </MathJax>
  ),
  h5: ({ children, id }) => (
    <MathJax>
      <h5 className="text-sm font-medium" id={id}>
        {children}
      </h5>
    </MathJax>
  ),
  h6: ({ children, id }) => (
    <MathJax>
      <h6 className="text-xs font-medium text-gray-600" id={id}>
        {children}
      </h6>
    </MathJax>
  ),
  strong: ({ children }) => (
    <MathJax>
      <strong className="font-bold">{children}</strong>
    </MathJax>
  ),
  em: ({ children }) => (
    <MathJax>
      <em className="italic">{children}</em>
    </MathJax>
  ),
  ul: ({ children }) => (
    <MathJax>
      <ul className="list-disc pl-6">{children}</ul>
    </MathJax>
  ),
  ol: ({ children }) => (
    <MathJax>
      <ol className="list-decimal pl-6">{children}</ol>
    </MathJax>
  ),
  li: ({ children }) => (
    <MathJax>
      <li className="mb-1">{children}</li>
    </MathJax>
  ),
  blockquote: ({ children }) => (
    <MathJax>
      <blockquote className="border-l-4 pl-4 italic text-gray-600">
        {children}
      </blockquote>
    </MathJax>
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
    <MathJax>
      <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-medium">
        {children}
      </th>
    </MathJax>
  ),
  td: ({ children }) => (
    <MathJax>
      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
        {children}
      </td>
    </MathJax>
  ),
};

// Optimized streaming text processor
const useStreamingProcessor = (content, isLoading) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);
  const animationFrameRef = useRef(null);

  const processStreamingContent = useCallback(() => {
    if (!content || !isLoading) {
      setDisplayedText(content || "");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
      processedIndexRef.current = 0;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      return;
    }

    const processNextChunk = () => {
      const chunkSize = 50;
      let i = 0;

      while (i < chunkSize && processedIndexRef.current < content.length) {
        const char = content[processedIndexRef.current];
        bufferRef.current += char;

        // Process thinking blocks
        if (bufferRef.current.includes("<think>")) {
          const [beforeThink] = bufferRef.current.split("<think>");
          setDisplayedText(beforeThink);
          setIsThinking(true);
          bufferRef.current = "";
        } else if (bufferRef.current.includes("</think>")) {
          const [thinkContent] = bufferRef.current.split("</think>");
          setThinkingContent(thinkContent);
          setIsThinking(false);
          bufferRef.current = "";
        } else if (!isThinking) {
          setDisplayedText((prev) => prev + char);
        } else {
          setThinkingContent((prev) => prev + char);
        }

        processedIndexRef.current++;
        i++;
      }

      if (processedIndexRef.current < content.length) {
        animationFrameRef.current = requestAnimationFrame(processNextChunk);
      }
    };

    // Reset state when starting to stream
    if (processedIndexRef.current === 0) {
      setDisplayedText("");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
    }

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [content, isLoading]);

  // Set up streaming effect
  useEffect(() => {
    processStreamingContent();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processStreamingContent]);

  return { displayedText, isThinking, thinkingContent };
};

// Main Markdown Renderer component
const MarkdownRenderer = memo(({ children, isDarkMode, isLoading }) => {
  // Always call hooks at the top level before any conditional returns
  const { displayedText, isThinking, thinkingContent } = useStreamingProcessor(
    children || "", // Provide default empty string to avoid null
    isLoading
  );

  // Nothing to display - moved after the hook call
  if (!children) return null;

  // Pre-process content to handle special LaTeX formats
  const processContent = (content) => {
    if (!content) return content;
    return preprocessContent(content);
  };

  // Split content for references section
  const hasReferences = children.includes("References:");
  const [mainContent, referencesContent] = hasReferences
    ? children.split("References:")
    : [children, null];

  return (
    <MathJaxContext config={mathJaxConfig}>
      <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
        {isLoading ? (
          <>
            {thinkingContent && (
              <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={rendererComponents}
            >
              {processContent(displayedText)}
            </ReactMarkdown>
          </>
        ) : (
          <>
            {/* Process thinking blocks for non-streaming mode */}
            {mainContent.split(/<think>([\s\S]*?)<\/think>/g).map((part, i) => {
              // Even indices are regular text, odd indices are thinking content
              return i % 2 === 0 ? (
                <ReactMarkdown
                  key={i}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={rendererComponents}
                >
                  {processContent(part)}
                </ReactMarkdown>
              ) : (
                <ThinkingBlock key={i}>{part}</ThinkingBlock>
              );
            })}
          </>
        )}
        {referencesContent && <ReferencesSection content={referencesContent} />}
      </div>
    </MathJaxContext>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
