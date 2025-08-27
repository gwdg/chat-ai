import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import DOMPurify from "dompurify";

import "katex/dist/katex.min.css";
import ThinkingBlock from "./ThinkingBlock";
import ReferencesSection from "./ReferencesSection";
import { rendererComponents } from "./rendererComponents";

// Preprocessor for LaTeX - keeping your existing logic
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

// Simplified streaming processor
const useStreamingProcessor = (content, isLoading) => {
  const [displayedText, setDisplayedText] = useState("");
  const [referencesContent, setReferencesContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);
  const animationFrameRef = useRef(null);

  const processStreamingContent = useCallback(() => {
    if (!content || !isLoading) {
      // Not streaming - show full content
      setDisplayedText(content || "");
      setIsStreaming(false);

      // Extract references if present
      if (content) {
        const rrefMatch = content.match(/\[RREF\d+\]/i);
        if (rrefMatch) {
          const splitIndex = content.lastIndexOf("\n", rrefMatch.index);
          if (splitIndex !== -1) {
            setDisplayedText(content.substring(0, splitIndex).trim());
            setReferencesContent(content.substring(splitIndex).trim());
          }
        }
      }

      bufferRef.current = "";
      processedIndexRef.current = 0;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Streaming mode
    setIsStreaming(true);

    const processNextChunk = () => {
      const chunkSize = 30;
      let i = 0;

      while (i < chunkSize && processedIndexRef.current < content.length) {
        const char = content[processedIndexRef.current];
        bufferRef.current += char;

        // Check for references
        const rrefMatch = bufferRef.current.match(/\[RREF\d+\]/i);
        if (rrefMatch) {
          // Found references - split content
          const splitIndex = bufferRef.current.lastIndexOf(
            "\n",
            rrefMatch.index
          );
          if (splitIndex !== -1) {
            const mainContent = bufferRef.current
              .substring(0, splitIndex)
              .trim();
            const refContent = bufferRef.current.substring(splitIndex).trim();
            setDisplayedText(mainContent);
            setReferencesContent(refContent);
          } else {
            setDisplayedText(bufferRef.current);
          }
        } else {
          // No references yet - show all content
          setDisplayedText(bufferRef.current);
        }

        processedIndexRef.current++;
        i++;
      }

      if (processedIndexRef.current < content.length) {
        animationFrameRef.current = requestAnimationFrame(processNextChunk);
      } else {
        setIsStreaming(false);
      }
    };

    if (processedIndexRef.current === 0) {
      setDisplayedText("");
      setReferencesContent("");
      bufferRef.current = "";
    }

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [content, isLoading]);

  useEffect(() => {
    processStreamingContent();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processStreamingContent]);

  return {
    displayedText,
    referencesContent,
    isStreaming,
  };
};

// Extract thinking blocks from content
const extractThinkingBlocks = (content) => {
  if (!content) return { mainContent: content, thinkingBlocks: [] };

  const thinkingBlocks = [];
  const parts = content.split(/<think>([\s\S]*?)<\/think>/g);

  const mainParts = [];
  parts.forEach((part, index) => {
    if (index % 2 === 0) {
      mainParts.push(part);
    } else {
      thinkingBlocks.push(part);
      mainParts.push(`{{THINKING_${Math.floor(index / 2)}}}`);
    }
  });

  return {
    mainContent: mainParts.join(""),
    thinkingBlocks,
  };
};

// Safe markdown wrapper
const SafeMarkdown = ({ children: markdownContent, ...props }) => {
  if (!markdownContent || typeof markdownContent !== "string") {
    return null;
  }

  try {
    // Strict DOMPurify config to prevent CSS injection
    const cleanContent = DOMPurify.sanitize(markdownContent, {
      // Remove dangerous tags that can contain CSS or scripts
      FORBID_TAGS: [
        "script",
        "style",
        "link",
        "meta",
        "title",
        "head",
        "html",
        "body",
        "object",
        "embed",
        "form",
        "input",
        "button",
        "textarea",
        "select",
        "option",
        "iframe",
        "frame",
        "frameset",
        "base",
      ],

      // Remove all event handlers and style attributes
      FORBID_ATTR: [
        "style",
        "onerror",
        "onload",
        "onclick",
        "onmouseover",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
        "onkeydown",
        "onkeyup",
        "onmousedown",
        "onmouseup",
        "onmousemove",
        "onmouseout",
        "onmouseover",
      ],

      // Additional security
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true,

      // Only allow safe href protocols
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });

    return <ReactMarkdown {...props}>{cleanContent}</ReactMarkdown>;
  } catch (error) {
    console.error("Error rendering markdown:", error);
    return (
      <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
        Error rendering content
      </div>
    );
  }
};

// Main MarkdownRenderer component
const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, renderMode = "Default" }) => {
    // KaTeX styling
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

    // Get streaming content
    const { displayedText, referencesContent, isStreaming } =
      useStreamingProcessor(children, isLoading);

    // Separate main content from references
    const separateContentAndReferences = useCallback((content) => {
      if (!content) return { main: "", refs: "" };

      // Check if there are any RREF markers
      const hasRREF = /\[RREF\d+\]/i.test(content);

      if (!hasRREF) {
        return { main: content, refs: "" };
      }

      // Find where references start
      const lines = content.split("\n");
      let refStartIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (/^\s*\[RREF\d+\]/i.test(lines[i].trim())) {
          refStartIndex = i;

          // Look back for a separator or header that marks reference section
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            const prevLine = lines[j].trim();
            if (
              /^[-=]{3,}$/.test(prevLine) ||
              /^(references?|sources?)\s*:?\s*$/i.test(prevLine) ||
              prevLine === ""
            ) {
              refStartIndex = j;
              break;
            }
          }
          break;
        }
      }

      if (refStartIndex === -1) {
        // RREF exists but couldn't find proper split
        return { main: content, refs: "" };
      }

      // Split content
      const mainLines = lines.slice(0, refStartIndex);
      const refLines = lines.slice(refStartIndex);

      // Clean up trailing separators from main content
      while (mainLines.length > 0) {
        const lastLine = mainLines[mainLines.length - 1].trim();
        if (
          !lastLine ||
          /^[-=]{3,}$/.test(lastLine) ||
          /^(references?|sources?)\s*:?\s*$/i.test(lastLine)
        ) {
          mainLines.pop();
        } else {
          break;
        }
      }

      return {
        main: mainLines.join("\n").trim(),
        refs: refLines.join("\n").trim(),
      };
    }, []);

    // Process content to separate main from references
    const { main: processedMainContent, refs: processedReferences } =
      useMemo(() => {
        const contentToProcess = isLoading ? displayedText : children;
        return separateContentAndReferences(contentToProcess);
      }, [displayedText, children, isLoading, separateContentAndReferences]);

    // Extract thinking blocks from main content only
    const { mainContent, thinkingBlocks } = useMemo(() => {
      return extractThinkingBlocks(processedMainContent);
    }, [processedMainContent]);

    // Get final references
    const finalReferences = useMemo(() => {
      return isLoading ? referencesContent : processedReferences;
    }, [isLoading, referencesContent, processedReferences]);

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

    // Render content based on mode
    const renderContentByMode = () => {
      const contentToRender = mainContent
        .replace(/\{\{THINKING_\d+\}\}/g, "") // Remove thinking placeholders
        .trim();

      switch (renderMode) {
        case "Plain Text":
          return (
            <pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto">
              {contentToRender}
            </pre>
          );

        case "LaTeX":
          return (
            <SafeMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
              components={{
                ...rendererComponents,
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
              }}
            >
              {preprocessLaTeX(contentToRender)}
            </SafeMarkdown>
          );

        case "Markdown":
          return (
            <SafeMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                ...rendererComponents,
                math: ({ value }) => (
                  <code className="text-pink-500">${value}$</code>
                ),
                inlineMath: ({ value }) => (
                  <code className="text-pink-500">${value}$</code>
                ),
              }}
            >
              {contentToRender}
            </SafeMarkdown>
          );

        default: // Default mode
          return (
            <SafeMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
              components={rendererComponents}
            >
              {preprocessLaTeX(contentToRender)}
            </SafeMarkdown>
          );
      }
    };

    if (!children) return null;

    return (
      <>
        <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
          {/* Render thinking blocks */}
          {thinkingBlocks.map((content, index) => (
            <ThinkingBlock key={`thinking-${index}`} autoExpand={isLoading}>
              {content}
            </ThinkingBlock>
          ))}

          {/* Render main content */}
          {renderContentByMode()}
        </div>

        {/* Render references section */}
        {finalReferences && (
          <ReferencesSection
            content={finalReferences}
            isLoading={isLoading}
            isStreaming={isStreaming}
          />
        )}
      </>
    );
  }
);

// Set display name for debugging
MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
