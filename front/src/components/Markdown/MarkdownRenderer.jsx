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

// Improved content extraction that handles any LLM format
const extractSpecialContent = (content) => {
  if (!content) return { mainContent: "", referencesContent: "" };

  try {
    // Check if content has RREF patterns
    const hasRREF = /\[RREF\d+\]/i.test(content);

    if (!hasRREF) {
      // No references found
      return { mainContent: content, referencesContent: "" };
    }

    // Find where references actually start
    const lines = content.split("\n");
    let firstRREFLine = -1;
    let referenceStartLine = -1;

    // Find the first RREF occurrence
    for (let i = 0; i < lines.length; i++) {
      if (/\[RREF\d+\]/i.test(lines[i])) {
        firstRREFLine = i;
        break;
      }
    }

    if (firstRREFLine === -1) {
      return { mainContent: content, referencesContent: "" };
    }

    // Look backwards from first RREF to find a logical separator
    for (let i = firstRREFLine; i >= 0; i--) {
      const line = lines[i].trim();

      // Check for explicit reference headers
      if (
        /^(references?|sources?|citations?|bibliography)\s*:?\s*$/i.test(line)
      ) {
        referenceStartLine = i;
        break;
      }

      // Check for horizontal rules (markdown separators)
      if (/^[-=_*]{3,}$/.test(line)) {
        referenceStartLine = i + 1;
        break;
      }

      // If we've gone back too far, assume references start at first RREF
      if (i < firstRREFLine - 10) {
        referenceStartLine = firstRREFLine;
        break;
      }
    }

    // Default fallback - use first RREF line
    if (referenceStartLine === -1) {
      referenceStartLine = firstRREFLine;
    }

    // Split the content
    const mainLines = lines.slice(0, referenceStartLine);
    const referenceLines = lines.slice(referenceStartLine);

    // Clean up main content - remove trailing empty lines and separators
    while (mainLines.length > 0) {
      const lastLine = mainLines[mainLines.length - 1].trim();
      if (
        lastLine === "" ||
        /^[-=_*]{3,}$/.test(lastLine) ||
        /^(references?|sources?)\s*:?\s*$/i.test(lastLine)
      ) {
        mainLines.pop();
      } else {
        break;
      }
    }

    const mainContent = mainLines.join("\n").trim();
    const referencesContent = referenceLines.join("\n").trim();

    // Final validation - ensure no RREF leaked into main content
    if (mainContent.includes("[RREF")) {
      console.warn("RREF found in main content, using emergency split");
      const firstRREFIndex = content.indexOf("[RREF");
      if (firstRREFIndex > 0) {
        return {
          mainContent: content.substring(0, firstRREFIndex).trim(),
          referencesContent: content.substring(firstRREFIndex).trim(),
        };
      }
    }

    return {
      mainContent,
      referencesContent,
    };
  } catch (error) {
    console.error("Error in content extraction:", error);
    // Safe fallback
    const firstRREFIndex = content.indexOf("[RREF");
    if (firstRREFIndex > 0) {
      return {
        mainContent: content.substring(0, firstRREFIndex).trim(),
        referencesContent: content.substring(firstRREFIndex).trim(),
      };
    }
    return { mainContent: content, referencesContent: "" };
  }
};

const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, renderMode = "Default" }) => {
    // Single useEffect for KaTeX styling
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
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }, []);

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

    // Safe wrapper for ReactMarkdown with HTML sanitization
    const SafeMarkdown = ({ children: markdownContent, ...props }) => {
      try {
        if (!markdownContent || markdownContent.trim() === "") {
          return null;
        }

        // Sanitize content to prevent HTML injection and page refreshes
        const sanitizedContent = markdownContent
          // Remove meta tags (especially refresh tags)
          .replace(/<meta[^>]*>/gi, "")
          // Remove script tags
          .replace(/<script[^>]*>.*?<\/script>/gi, "")
          // Remove other potentially dangerous HTML
          .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "")
          .replace(/<object[^>]*>.*?<\/object>/gi, "")
          .replace(/<embed[^>]*>/gi, "")
          .replace(/<form[^>]*>.*?<\/form>/gi, "")
          // Remove javascript: links
          .replace(/javascript:/gi, "")
          // Remove on* event handlers
          .replace(/\son\w+\s*=\s*[^>]*/gi, "");

        return <ReactMarkdown {...props}>{sanitizedContent}</ReactMarkdown>;
      } catch (error) {
        console.error("Error rendering markdown:", error);
        return (
          <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            Error rendering content: {error.message}
          </div>
        );
      }
    };

    // LaTeX-only mode
    if (renderMode === "LaTeX") {
      const latexOnlyComponents = {
        ...rendererComponents,
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

          {(isLoading ? displayedText : mainContent)
            .split(/<think>([\s\S]*?)<\/think>/g)
            .map((part, i) => {
              return i % 2 === 0 ? (
                <SafeMarkdown
                  key={`part-${i}`}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                  components={latexOnlyComponents}
                >
                  {preprocessLaTeX(part)}
                </SafeMarkdown>
              ) : (
                <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
              );
            })}

          {referencesContent && (
            <ReferencesSection content={referencesContent} />
          )}
        </div>
      );
    }

    // Markdown mode
    if (renderMode === "Markdown") {
      const markdownModeComponents = {
        ...rendererComponents,
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

          {(isLoading ? displayedText : mainContent)
            .split(/<think>([\s\S]*?)<\/think>/g)
            .map((part, i) => {
              return i % 2 === 0 ? (
                <SafeMarkdown
                  key={`part-${i}`}
                  remarkPlugins={[remarkGfm]}
                  components={markdownModeComponents}
                >
                  {part}
                </SafeMarkdown>
              ) : (
                <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
              );
            })}

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
              <SafeMarkdown
                key={`part-${i}`}
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                components={rendererComponents}
              >
                {preprocessLaTeX(part)}
              </SafeMarkdown>
            ) : (
              <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
            );
          })}

        {/* References section */}
        {referencesContent && referencesContent.trim() && (
          <ReferencesSection content={referencesContent} />
        )}
      </div>
    );
  }
);

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
