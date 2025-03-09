/* eslint-disable no-unused-vars */
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  memo,
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
import ErrorBoundary from "./ErrorBoundary";

// KaTeX configuration options - memoized to prevent unnecessary re-renders
const katexOptions = {
  throwOnError: false,
  displayMode: false,
  output: "html",
  trust: true,
  macros: {},
  strict: "ignore", // Ignore Unicode warnings
  maxSize: 4, // Increased size limit for complex expressions
  maxExpand: 1000, // Allow more macro expansions
};

/**
 * Improved preprocessor for LaTeX expressions in markdown
 * This function detects various LaTeX patterns and ensures they're properly wrapped in delimiters
 */

const preprocessLatex = (text) => {
  if (!text) return "";

  // Split by code blocks to protect them from processing
  const codeBlockRegex = /(```[\s\S]*?```|`[^`]+`)/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  // More efficient splitting that correctly handles nested code blocks
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.substring(lastIndex, match.index));
    }
    segments.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(text.substring(lastIndex));
  }

  return segments
    .map((segment) => {
      // Skip code blocks
      if (segment.startsWith("```") || segment.startsWith("`")) {
        return segment;
      }

      let processed = segment;

      // 1. Pre-process Black-Scholes specific notation for better rendering
      processed = processed.replace(/d_?1|d1|d_\{1\}/g, "d_{1}");
      processed = processed.replace(/d_?2|d2|d_\{2\}/g, "d_{2}");
      processed = processed.replace(/S_?0|S0|S_\{0\}/g, "S_{0}");
      processed = processed.replace(/N\(([^)]+)\)/g, "N($1)");
      processed = processed.replace(/\\sigma/g, "\\sigma");

      // 2. Handle display equations (multi-line) with $$ ... $$
      processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        return `$$${formula.trim()}$$`;
      });

      // Safe wrapper for pattern matching
      const safeWrapWithDelimiters = (match, p1, p2) => {
        if (!match || typeof match !== "string") {
          return match || "";
        }

        // Skip if already wrapped in math delimiters
        if (
          match.startsWith("$") ||
          match.startsWith("\\(") ||
          match.startsWith("\\begin")
        ) {
          return match;
        }

        // For assignments (equations with =), use display math
        if (p1 && typeof p1 === "string" && p1.includes("=")) {
          return `$$${match}$$`;
        }

        // For simple expressions, use inline math
        return `$${match}$`;
      };

      // 3. Handle complex equation formats with improved patterns
      const equationPatterns = [
        // Square roots
        /\\sqrt{[^}]*}/g,

        // Fractions
        /\\frac{[^}]*}{[^}]*}/g,

        // Equations with variable assignments
        /\b([A-Za-z](?:\([^)]*\))?\s*=\s*)(\\?(?:frac|sum|prod|int|lim|sup|inf|max|min)[\s\S]*?)(?=$|\n\s*\n|\n[A-Z])/g,

        // Greek letters and other mathematical symbols
        /(?<!\w)(\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|partial|nabla))(?!\w)/g,

        // N(x) cumulative distribution notation
        /N\s*\(\s*([^)]+)\s*\)/g,
      ];

      // Safely apply patterns
      equationPatterns.forEach((pattern) => {
        processed = processed.replace(pattern, safeWrapWithDelimiters);
      });

      // 4. Handle Black-Scholes specific formulas
      if (
        typeof processed === "string" &&
        processed.includes("Black-Scholes")
      ) {
        // Look for Black-Scholes formula pattern
        processed = processed.replace(
          /d_?\{?1\}?\s*=\s*[^$\n]+(?=$|\n)/g,
          (match) => `$${match}$`
        );

        processed = processed.replace(
          /d_?\{?2\}?\s*=\s*[^$\n]+(?=$|\n)/g,
          (match) => `$${match}$`
        );
      }

      // 5. Ensure all math expressions have proper spacing
      processed = processed.replace(/\$([^$]+)\$/g, (match, content) => {
        if (typeof content !== "string") return match;
        return `$${content.trim()}$`;
      });

      // 6. Fix any cases of triple dollars (artifact of earlier replacements)
      processed = processed.replace(/\${3}/g, "$$");

      return processed;
    })
    .join("");
};
/**
 * Component for rendering math expressions
 */
const MathComponent = memo(({ value }) => {
  try {
    if (!value || typeof value !== "string") {
      return <span className="text-red-500">⚠️ Invalid LaTeX ⚠️</span>;
    }

    // Remove surrounding parentheses if they exist
    const cleanValue = value.trim().replace(/^\((.*)\)$/, "$1");

    // Handle special Unicode characters
    const sanitizedValue = cleanValue.replace(/([ŷŵǔǚńḿǹ])/g, "\\text{$1}");

    // Add safety check for very complex expressions
    if (sanitizedValue.length > 1000) {
      console.warn(
        "Very large LaTeX expression detected:",
        sanitizedValue.substring(0, 100) + "..."
      );
    }

    return (
      <span
        role="math"
        aria-label={cleanValue}
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(sanitizedValue, katexOptions),
        }}
      />
    );
  } catch (error) {
    console.error("LaTeX rendering error:", error, value);
    return (
      <span className="text-red-500">
        ⚠️ Error rendering LaTeX: {error.message} ⚠️
      </span>
    );
  }
});

MathComponent.displayName = "MathComponent";

// Optimized markdown component renderers
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
  inlineMath: MathComponent, // Add explicit handler for inline math
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
 * Improved reference parsing utility
 */
const parseReferences = (content) => {
  if (!content) return [];

  // Extract references in format [RREF#] with improved regex
  const refRegex = /\[RREF(\d+)\](.*?)(?=\n\[RREF|$)/gs;
  const matches = [...content.matchAll(refRegex)];

  return matches.map((match, index) => ({
    number: parseInt(match[1], 10) - 1, // Use the actual number from the reference
    content: match[0].trim(),
  }));
};

/**
 * Component for displaying a single reference item
 */
const ReferenceItem = forwardRef(({ reference }, ref) => {
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(
    ref,
    () => (open) => setIsOpen(typeof open === "boolean" ? open : !isOpen)
  );

  // Extract title components intelligently
  const { displayTitle, urlPart, restPart } = useMemo(() => {
    const firstLine = reference.content.split("\n")[0];

    // Remove the RREF part to get just the content
    const contentWithoutRef = firstLine.replace(/\[RREF\d+\]\s*/, "").trim();

    // Try to extract URL if present
    let urlPart = "";
    let restPart = "";

    if (contentWithoutRef.includes("http")) {
      // Handle URL reference - extract URL and remove $ at the end of score
      const urlMatch = contentWithoutRef.match(/(https?:\/\/[^,\s]+)([^]*)/);
      if (urlMatch) {
        urlPart = urlMatch[1];
        // Remove $ from the score part
        restPart = urlMatch[2] ? urlMatch[2].replace(/\$(\s*)$/, "$1") : "";
      }
    } else if (contentWithoutRef.startsWith("$")) {
      // Handle case where filename starts with $
      const parts = contentWithoutRef.substring(1).split(",");
      urlPart = parts[0].trim();
      if (parts.length > 1) {
        restPart =
          "," +
          parts
            .slice(1)
            .join(",")
            .replace(/\$(\s*)$/, "$1");
      } else {
        restPart = "";
      }
    } else if (contentWithoutRef.startsWith("y:")) {
      // Handle the case where it's just a score starting with y:
      // Remove $ at the end
      urlPart = "";
      restPart = contentWithoutRef.replace(/\$(\s*)$/, "$1");
    } else {
      // Handle other non-URL cases
      const parts = contentWithoutRef.split(",");

      if (parts.length > 1 && !parts[0].startsWith("y:")) {
        // It's a filename with score
        urlPart = parts[0].trim();
        // Join the rest but remove $ at the end
        const joinedRest = "," + parts.slice(1).join(",");
        restPart = joinedRest.replace(/\$(\s*)$/, "$1");
      } else {
        // It's just a score or other text - remove $ at the end
        urlPart = "";
        restPart = contentWithoutRef.replace(/\$(\s*)$/, "$1");
      }
    }

    return {
      displayTitle: contentWithoutRef.replace(/\$(\s*)$/, "$1"),
      urlPart: urlPart,
      restPart: restPart,
    };
  }, [reference.content]);

  // Content without the title line
  const contentWithoutTitle = useMemo(() => {
    const lines = reference.content.split("\n");
    return lines.slice(1).join("\n").trim();
  }, [reference.content]);

  // Check if it's a URL
  const isUrl = urlPart.startsWith("http");

  return (
    <div className="border-l-4 border-l-blue-500/50 hover:border-l-blue-500 transition-colors">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between group"
        aria-expanded={isOpen}
        aria-controls={`reference-${reference.number}`}
      >
        <div className="flex items-center gap-2 flex-grow overflow-hidden">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 whitespace-nowrap">
            RREF {reference.number + 1}
          </span>
          <div className="text-sm font-bold truncate text-gray-700 dark:text-gray-300">
            {isUrl ? (
              <>
                <a
                  href={urlPart}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-500 hover:underline"
                >
                  {urlPart}
                </a>
                {restPart}
              </>
            ) : (
              <>
                {urlPart && <span>{urlPart}</span>}
                {restPart}
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
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
            {contentWithoutTitle}
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
const ReferencesSection = memo(({ content }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  // Parse references from content with memoization
  const references = useMemo(() => parseReferences(content), [content]);

  // Create plain text version of all references for copying
  const allReferencesText = useMemo(() => {
    if (references.length === 0) return "";
    return references.map((ref) => ref.content).join("\n\n");
  }, [references]);

  if (references.length === 0) return null;

  // Function to copy all references to clipboard
  const copyAllReferences = async () => {
    try {
      await navigator.clipboard.writeText(allReferencesText);
      setCopySuccess(true);

      // Reset success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy references:", err);
      setCopySuccess(false);
    }
  };

  return (
    <div className="mt-8 border rounded-xl border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            References
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({references.length})
          </span>
        </div>
        <button
          onClick={copyAllReferences}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/70 text-blue-700 dark:text-blue-300 rounded transition-colors"
          aria-label="Copy all references"
          title="Copy all references to clipboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-1"
          >
            {copySuccess ? (
              <>
                <path d="M20 6L9 17l-5-5" />
              </>
            ) : (
              <>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </>
            )}
          </svg>
          {copySuccess ? "Copied!" : "Copy All"}
        </button>
      </div>
      <div>
        {references.map((ref) => (
          <ReferenceItem key={ref.number} reference={ref} />
        ))}
      </div>
    </div>
  );
});

ReferencesSection.displayName = "ReferencesSection";

/**
 * Component for displaying the thinking process
 */
const ThinkingBlock = memo(({ children, autoExpand = false }) => {
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
});

ThinkingBlock.displayName = "ThinkingBlock";

/**
 * Optimized streaming text processor with Web Workers support if available
 */
const useStreamingProcessor = (content, isLoading) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);
  const animationFrameRef = useRef(null);

  const processStreamingContent = useCallback(() => {
    if (!content || !isLoading) {
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
      const chunkSize = 50; // Increased for better performance
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
          setThinkingContent(bufferRef.current);
        }

        processedIndexRef.current++;
        i++;
      }

      if (processedIndexRef.current < content.length) {
        animationFrameRef.current = requestAnimationFrame(processNextChunk);
      }
    };

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

/**
 * Main Markdown Renderer component
 */
const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, convertParenthesesLatex = true }) => {
    // Process the content before rendering with improved LaTeX handling
    const processedContent = useMemo(() => {
      if (!children) return "";
      return convertParenthesesLatex ? preprocessLatex(children) : children;
    }, [children, convertParenthesesLatex]);

    // Use optimized streaming processor
    const { displayedText, isThinking, thinkingContent } =
      useStreamingProcessor(processedContent, isLoading);

    // Nothing to display
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
            <ErrorBoundary
              fallback={<div>Error rendering Markdown content</div>}
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={components}
              >
                {displayedText}
              </ReactMarkdown>
            </ErrorBoundary>
          )}
          {referencesContent && (
            <ErrorBoundary fallback={<div>Error loading references</div>}>
              <ReferencesSection content={referencesContent} />
            </ErrorBoundary>
          )}
        </div>
      );
    }

    // Normal (non-loading) state with optimized rendering
    const [mainContent, referencesContent] =
      processedContent.split("References:");

    // More efficient think block processing
    const thinkingRegex = /<think>([\s\S]*?)<\/think>/g;
    let match;
    let lastIndex = 0;
    const contentParts = [];

    while ((match = thinkingRegex.exec(mainContent)) !== null) {
      // Add the content before this thinking block
      if (match.index > lastIndex) {
        contentParts.push({
          type: "text",
          content: mainContent.substring(lastIndex, match.index),
        });
      }

      // Add the thinking block
      contentParts.push({
        type: "thinking",
        content: match[1],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining content after the last thinking block
    if (lastIndex < mainContent.length) {
      contentParts.push({
        type: "text",
        content: mainContent.substring(lastIndex),
      });
    }

    return (
      <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
        {contentParts.map((part, index) => (
          <ErrorBoundary
            key={index}
            fallback={<div>Error rendering content part</div>}
          >
            {part.type === "thinking" ? (
              <ThinkingBlock>{part.content}</ThinkingBlock>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={components}
              >
                {part.content}
              </ReactMarkdown>
            )}
          </ErrorBoundary>
        ))}
        {referencesContent && (
          <ErrorBoundary fallback={<div>Error loading references</div>}>
            <ReferencesSection content={referencesContent} />
          </ErrorBoundary>
        )}
      </div>
    );
  }
);

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
