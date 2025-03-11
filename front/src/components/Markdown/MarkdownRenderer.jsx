// MarkdownRenderer.jsx
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

/**
 * Preprocesses LaTeX content by replacing delimiters and escaping certain characters.
 * @param {string} content - The input string containing LaTeX expressions.
 * @returns {string} - The processed string with replaced delimiters and escaped characters.
 */
const preprocessLaTeX = (content) => {
  if (!content) return "";

  // Step 1: Protect code blocks
  const codeBlocks = [];
  let processedContent = content.replace(
    /(```[\s\S]*?```|`[^`\n]+`)/g,
    (match, code) => {
      codeBlocks.push(code);
      return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
    }
  );

  // Step 2: Protect existing LaTeX expressions
  const latexExpressions = [];
  processedContent = processedContent.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g,
    (match) => {
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    }
  );

  // Step 3: Escape dollar signs that are likely currency indicators
  processedContent = processedContent.replace(/\$(?=\d)/g, "\\$");

  // Step 4: Restore LaTeX expressions
  processedContent = processedContent.replace(
    /<<LATEX_(\d+)>>/g,
    (_, index) => latexExpressions[parseInt(index)]
  );

  // Step 5: Restore code blocks
  processedContent = processedContent.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, index) => codeBlocks[parseInt(index)]
  );

  // Step 6: Convert LaTeX delimiters to KaTeX-compatible format
  processedContent = processedContent
    .replace(/\\\[/g, "$$") // Replace '\[' with '$$'
    .replace(/\\\]/g, "$$") // Replace '\]' with '$$'
    .replace(/\\\(/g, "$") // Replace '\(' with '$'
    .replace(/\\\)/g, "$"); // Replace '\)' with '$'

  return processedContent;
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

    // Reset state when starting to stream
    if (processedIndexRef.current === 0) {
      setDisplayedText("");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
    }

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [content, isLoading, isThinking]);

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
  // Add CSS for centered math
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

  // Use optimized streaming processor
  const { displayedText, thinkingContent } = useStreamingProcessor(
    children,
    isLoading
  );

  // Nothing to display
  if (!children) return null;

  // Process the content for LaTeX
  const processContent = (text) => {
    if (!text) return "";
    return preprocessLaTeX(text);
  };

  // Split content for references section
  const hasReferences = children.includes("References:");
  const [mainContent, referencesContent] = hasReferences
    ? children.split("References:")
    : [children, null];

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
      {isLoading ? (
        <>
          {thinkingContent && (
            <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
          )}
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
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
                key={`part-${i}`}
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                components={rendererComponents}
              >
                {processContent(part)}
              </ReactMarkdown>
            ) : (
              <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
            );
          })}
        </>
      )}
      {referencesContent && <ReferencesSection content={referencesContent} />}
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
