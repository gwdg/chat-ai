import { useState, useEffect, useRef, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import ThinkingBlock from "./ThinkingBlock";
import ReferencesSection from "./ReferencesSection";
import { rendererComponents } from "./rendererComponents";

const preprocessLaTeX = (content) => {
  if (!content) return "";

  const codeBlocks = [];
  let processedContent = content.replace(
    /(```[\s\S]*?```|`[^`\n]+`)/g,
    (match, code) => {
      codeBlocks.push(code);
      return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
    }
  );

  const latexExpressions = [];
  processedContent = processedContent.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g,
    (match) => {
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    }
  );

  processedContent = processedContent.replace(/\$(?=\d)/g, "\\$");

  processedContent = processedContent.replace(
    /<<LATEX_(\d+)>>/g,
    (_, index) => latexExpressions[parseInt(index)]
  );

  processedContent = processedContent.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, index) => codeBlocks[parseInt(index)]
  );

  processedContent = processedContent
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");

  return processedContent;
};

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
          setDisplayedText(bufferRef.current);
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

    if (processedIndexRef.current === 0) {
      setDisplayedText("");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
    }

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [content, isLoading, isThinking]);

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

// Extract references and thinking content
const extractSpecialContent = (content) => {
  if (!content) return { mainContent: "", referencesContent: "" };

  // Extract references
  const hasReferences = content.includes("References:");
  const [mainContent, referencesContent] = hasReferences
    ? content.split("References:")
    : [content, null];

  // Clean up the mainContent to remove the dash separator
  let cleanedMainContent = mainContent;
  if (cleanedMainContent) {
    // Remove lines that are just dashes (markdown horizontal rule syntax)
    cleanedMainContent = cleanedMainContent
      .replace(/\n[-=_]{3,}\s*$/g, "") // More robust: handles dashes, equals, underscores
      .trim();
  }

  return {
    mainContent: cleanedMainContent,
    referencesContent,
  };
};

const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, renderMode = "Default" }) => {
    // Single useEffect for KaTeX styling with empty dependency array
    useEffect(() => {
      const style = document.createElement("style");
      style.textContent = `
        .katex-display {
          display: flex !important;
          justify-content: center !important;
          text-align: center !important;
          margin: 1em 0 !important;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }, []); // Empty dependency array - runs once on mount

    const { displayedText, thinkingContent } = useStreamingProcessor(
      children,
      isLoading
    );

    if (!children) return null;

    const { mainContent, referencesContent } = extractSpecialContent(
      isLoading ? displayedText : children
    );

    // Configure KaTeX options
    const katexOptions = {
      output: "htmlAndMathml",
      throwOnError: false,
      trust: true,
      strict: false,
      macros: {
        "\\f": "#1f(#2)",
      },
    };

    // LaTeX-only mode - render only LaTeX expressions and show other content as plain text
    if (renderMode === "LaTeX") {
      const latexOnlyComponents = {
        ...rendererComponents,
        // Override all components except math to show as plain text
        p: ({ children }) => (
          <p className="mb-3 font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">
            {children}
          </p>
        ),
        h1: ({ children }) => (
          <div className="text-lg font-mono font-bold mt-4 mb-2 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            # {children}
          </div>
        ),
        h2: ({ children }) => (
          <div className="text-md font-mono font-semibold mt-3 mb-2 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            ## {children}
          </div>
        ),
        h3: ({ children }) => (
          <div className="text-sm font-mono font-medium mt-2 mb-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            ### {children}
          </div>
        ),
        h4: ({ children }) => (
          <div className="text-sm font-mono mt-2 mb-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            #### {children}
          </div>
        ),
        h5: ({ children }) => (
          <div className="text-xs font-mono mt-1 mb-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            ##### {children}
          </div>
        ),
        h6: ({ children }) => (
          <div className="text-xs font-mono mt-1 mb-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            ###### {children}
          </div>
        ),
        strong: ({ children }) => (
          <span className="font-mono px-1">**{children}**</span>
        ),
        em: ({ children }) => (
          <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1">
            *{children}*
          </span>
        ),
        code: ({ inline, className, children }) => {
          const content = String(children).replace(/\n$/, "");
          if (inline) {
            return (
              <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                `{content}`
              </code>
            );
          }
          return (
            <pre className="font-mono bg-gray-100 dark:bg-gray-800 p-3 rounded mt-2 mb-2 text-xs overflow-x-auto">
              ```{className?.replace("language-", "") || ""}
              {"\n"}
              {content}
              {"\n"}```
            </pre>
          );
        },
        ul: ({ children }) => (
          <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2">
            {children}
          </div>
        ),
        ol: ({ children }) => (
          <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2">
            {children}
          </div>
        ),
        li: ({ children }) => <div className="text-sm">- {children}</div>,
        blockquote: ({ children }) => (
          <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2 border-l-4 border-gray-400">
            &gt; {children}
          </div>
        ),
        a: ({ href, children }) => (
          <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">
            [{children}]({href})
          </span>
        ),
        // Keep math rendering functional
        math: ({ value }) => (
          <div className="my-4 text-center p-4 bg-green-50 dark:bg-green-900/20 rounded border-2 border-green-200 dark:border-green-700">
            <span className="katex-display">{value}</span>
          </div>
        ),
        inlineMath: ({ value }) => (
          <span className="katex bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded border border-green-300 dark:border-green-600">
            {value}
          </span>
        ),
      };

      return (
        <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
          {isLoading && thinkingContent && (
            <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
          )}

          {/* Main content */}
          {(isLoading ? displayedText : mainContent)
            .split(/<think>([\s\S]*?)<\/think>/g)
            .map((part, i) => {
              return i % 2 === 0 ? (
                <ReactMarkdown
                  key={`part-${i}`}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                  components={latexOnlyComponents}
                >
                  {preprocessLaTeX(part)}
                </ReactMarkdown>
              ) : (
                <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
              );
            })}

          {/* References section */}
          {referencesContent && (
            <ReferencesSection content={referencesContent} />
          )}
        </div>
      );
    }

    // Markdown mode - display raw markdown with only code blocks rendered
    if (renderMode === "Markdown") {
      // Custom components for Markdown mode - only render code blocks
      const markdownModeComponents = {
        ...rendererComponents,
        // Override math components to show raw LaTeX
        math: ({ value }) => <code className="text-pink-500">${value}$</code>,
        inlineMath: ({ value }) => (
          <code className="text-pink-500">${value}$</code>
        ),
      };

      return (
        <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
          {isLoading && thinkingContent && (
            <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
          )}

          {/* Main content */}
          {(isLoading ? displayedText : mainContent)
            .split(/<think>([\s\S]*?)<\/think>/g)
            .map((part, i) => {
              return i % 2 === 0 ? (
                <ReactMarkdown
                  key={`part-${i}`}
                  remarkPlugins={[remarkGfm]} // No math plugins
                  components={markdownModeComponents}
                >
                  {part}
                </ReactMarkdown>
              ) : (
                <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
              );
            })}

          {/* References section */}
          {referencesContent && (
            <ReferencesSection content={referencesContent} />
          )}
        </div>
      );
    }

    // Default mode - full rendering
    return (
      <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
        {isLoading && thinkingContent && (
          <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
        )}

        {/* Main content */}
        {(isLoading ? displayedText : mainContent)
          .split(/<think>([\s\S]*?)<\/think>/g)
          .map((part, i) => {
            return i % 2 === 0 ? (
              <ReactMarkdown
                key={`part-${i}`}
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                components={rendererComponents}
              >
                {preprocessLaTeX(part)}
              </ReactMarkdown>
            ) : (
              <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
            );
          })}

        {/* References section */}
        {referencesContent && <ReferencesSection content={referencesContent} />}
      </div>
    );
  }
);

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
