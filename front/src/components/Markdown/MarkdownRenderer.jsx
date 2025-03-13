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

  return { mainContent, referencesContent };
};

const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, renderMode = "Default" }) => {
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
    }, []);

    const { displayedText, thinkingContent } = useStreamingProcessor(
      children,
      isLoading
    );

    if (!children) return null;

    // Extract references section for all modes
    const { mainContent, referencesContent } = extractSpecialContent(
      isLoading ? displayedText : children
    );

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
