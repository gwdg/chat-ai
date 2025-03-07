/* eslint-disable no-unused-vars */
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import katex from "katex";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import Code from "./Code";
import "katex/dist/katex.min.css";
import { forwardRef, useImperativeHandle } from "react";
import ErrorBoundary from "./ErrorBoundary";

// KaTeX configuration options - memoized to prevent unnecessary re-renders
const katexOptions = {
  strict: false,
  throwOnError: false,
  displayMode: false,
  output: "html",
  trust: true,
  macros: {},
};

/**
 * Preprocesses LaTeX in parentheses to make it compatible with KaTeX
 * @param {string} text - The markdown text to process
 * @returns {string} Processed text with LaTeX expressions converted to KaTeX format
 */
const preprocessLatex = (text) => {
  if (!text) return "";

  // Split the text to protect code blocks from processing
  const segments = text.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return segments
    .map((segment) => {
      // Skip code blocks
      if (segment.startsWith("```") || segment.startsWith("`")) {
        return segment;
      }

      // Pattern to match LaTeX expressions in parentheses
      const latexPattern =
        /\(([^()]*?(?:\([^()]*\)[^()]*?)*?(?:\\[a-zA-Z]+{.*?}|\^|_|\\frac|\\sqrt|\\sum|\\int|\\lim).*?)\)/g;

      // Replace matched patterns with KaTeX compatible format
      return segment.replace(latexPattern, (match, latexContent) => {
        if (latexContent.match(/\\[a-zA-Z]+|[\^_]|\{|\}/)) {
          return `$${latexContent}$`;
        }
        return match;
      });
    })
    .join("");
};

/**
 * Component for rendering math expressions
 */
const MathComponent = React.memo(({ value }) => {
  try {
    if (!value || typeof value !== "string") {
      return <span className="text-red-500">⚠️ Invalid LaTeX ⚠️</span>;
    }

    // Remove surrounding parentheses if they exist
    const cleanValue = value.trim().replace(/^\((.*)\)$/, "$1");

    return (
      <span
        role="math"
        aria-label={cleanValue}
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(cleanValue, katexOptions),
        }}
      />
    );
  } catch (error) {
    console.error("LaTeX rendering error:", error);
    return <span className="text-red-500">⚠️ Invalid LaTeX ⚠️</span>;
  }
});

MathComponent.displayName = "MathComponent";

// Markdown component renderers
const components = {
  code: ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const content = String(children).replace(/\n$/, "");

    return inline ? (
      <code
        className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-sm"
        {...props}
      >
        {content}
      </code>
    ) : (
      <Code language={match?.[1]}>{content}</Code>
    );
  },
  math: MathComponent,
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
  p: ({ children }) => <p className="mb-3">{children}</p>,
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
  // Enhanced table components with better accessibility and styling
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

/**
 * Component for displaying a single reference item
 */
const ReferenceItem = forwardRef(({ reference, isExpanded }, ref) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(isExpanded);
  }, [isExpanded]);

  useImperativeHandle(
    ref,
    () => (open) => setIsOpen(typeof open === "boolean" ? open : !isOpen)
  );

  return (
    <div className="border-l-4 border-l-blue-500/50 hover:border-l-blue-500 transition-colors">
      <button
        aria-expanded={isOpen}
        aria-controls={`reference-${reference.number}`}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200">
            RREF {reference.number}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">
            {reference.content.split("\n")[0]}
          </span>
        </div>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && (
        <div
          id={`reference-${reference.number}`}
          className="px-4 py-3 bg-gray-50 dark:bg-gray-800/30"
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={components}
          >
            {reference.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
});

ReferenceItem.displayName = "ReferenceItem";

/**
 * Section for displaying all references
 */
const ReferencesSection = ({ content }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [allExpanded, setAllExpanded] = useState(false);
  const itemRefs = useRef(new Map());

  // Parse references from content
  const references = useMemo(
    () =>
      content
        .split(/\d+\.\s+\[RREF\s+\d+\]:\s+/)
        .filter(Boolean)
        .map((ref, index) => ({
          number: index,
          content: ref.trim(),
        })),
    [content]
  );

  // Toggle all references open/closed
  const toggleAll = useCallback(() => {
    setAllExpanded(!allExpanded);
    itemRefs.current.forEach((ref) => ref(!allExpanded));
  }, [allExpanded]);

  if (references.length === 0) return null;

  return isVisible ? (
    <div className="mt-8 border rounded-xl border-gray-200 dark:border-gray-700 overflow-hidden">
      <button onClick={() => setIsVisible(false)} className="w-full">
        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-200 dark:hover:bg-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              References
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({references.length})
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAll();
            }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 min-h-[25px]"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </button>
      <div>
        {references.map((ref) => (
          <ReferenceItem
            key={ref.number}
            reference={ref}
            ref={(toggleFn) =>
              toggleFn && itemRefs.current.set(ref.number, toggleFn)
            }
            isExpanded={allExpanded}
          />
        ))}
      </div>
    </div>
  ) : (
    <button
      onClick={() => setIsVisible(true)}
      className="mt-8 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
    >
      Show References ({references.length})
    </button>
  );
};

/**
 * Component for displaying the thinking process
 */
const ThinkingBlock = ({ children, autoExpand = false }) => {
  const [isOpen, setIsOpen] = useState(autoExpand);
  const contentRef = useRef(null);

  // Auto-scroll to thinking block when it expands automatically
  useEffect(() => {
    if (autoExpand && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [autoExpand]);

  return (
    <div className="my-4 rounded-lg border border-tertiary">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full p-3 text-sm bg-blue-50 dark:bg-blue-900/30 rounded-t-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
        aria-expanded={isOpen}
        aria-controls="thinking-content"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Brain size={16} className="ml-2 mr-2" />
        <span>Thinking Process</span>
      </button>
      {isOpen && (
        <div
          id="thinking-content"
          ref={contentRef}
          className="p-3 text-sm bg-blue-50/50 dark:bg-blue-900/20 rounded-b-lg"
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={components}
          >
            {children}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

/**
 * Main Markdown Renderer component
 */
const MarkdownRenderer = ({
  children,
  isDarkMode,
  isLoading,
  convertParenthesesLatex = true,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);
  const animationFrameRef = useRef(null);

  // Process the content before rendering
  const processedContent = useMemo(() => {
    if (!children) return "";
    return convertParenthesesLatex ? preprocessLatex(children) : children;
  }, [children, convertParenthesesLatex]);

  // Function to handle streaming updates with better performance
  const processStreamingContent = useCallback(() => {
    if (!processedContent || !isLoading) {
      setDisplayedText("");
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
      // Process multiple characters per frame for better performance
      const chunkSize = 20;
      let i = 0;

      while (
        i < chunkSize &&
        processedIndexRef.current < processedContent.length
      ) {
        const char = processedContent[processedIndexRef.current];
        bufferRef.current += char;

        // Don't allow stray $ signs to appear mid-render
        if (!isThinking && bufferRef.current.endsWith("$")) {
          bufferRef.current = bufferRef.current.slice(0, -1);
        }

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
          setThinkingContent(bufferRef.current);
        }

        processedIndexRef.current++;
        i++;
      }

      if (processedIndexRef.current < processedContent.length) {
        animationFrameRef.current = requestAnimationFrame(processNextChunk);
      }
    };

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [processedContent, isLoading]);

  // Set up streaming effect when isLoading or content changes
  useEffect(() => {
    processStreamingContent();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processStreamingContent]);

  if (!processedContent) return null;

  // Loading state with streaming display
  if (isLoading) {
    const [mainContent, referencesContent] =
      processedContent.split("References:");
    return (
      <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
        {thinkingContent && (
          <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
        )}
        {displayedText && (
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={components}
          >
            {displayedText}
          </ReactMarkdown>
        )}
        {referencesContent && (
          <ErrorBoundary fallback={<div>Error loading references</div>}>
            <ReferencesSection content={referencesContent} />
          </ErrorBoundary>
        )}
      </div>
    );
  }

  // Normal (non-loading) state
  const [mainContent, referencesContent] =
    processedContent.split("References:");
  const parts = mainContent.split(/(<think>|<\/think>)/);

  return (
    <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
      {parts.map((part, index) => {
        if (part === "<think>") return null;
        if (parts[index - 1] === "<think>" && part !== "</think>") {
          return <ThinkingBlock key={index}>{part}</ThinkingBlock>;
        }
        if (part !== "</think>") {
          return (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex, rehypeRaw]}
              components={components}
            >
              {part}
            </ReactMarkdown>
          );
        }
        return null;
      })}
      {referencesContent && (
        <ErrorBoundary fallback={<div>Error loading references</div>}>
          <ReferencesSection content={referencesContent} />
        </ErrorBoundary>
      )}
    </div>
  );
};

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
