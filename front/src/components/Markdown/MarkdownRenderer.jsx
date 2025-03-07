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
  throwOnError: false,
  displayMode: false,
  output: "html",
  trust: true,
  macros: {},
  strict: "ignore", // Ignore Unicode warnings
};

/**
 * Function to handle standalone LaTeX expressions that aren't in the standard format
 * @param {string} content - The content to process
 * @returns {string} Processed content with standalone LaTeX expressions properly formatted
 */
const processStandaloneLatex = (content) => {
  if (!content) return content;

  // Pattern to match equations that start with letter = expression
  // Commonly used format in academic/technical writing
  const standaloneEquationPattern =
    /^([A-Za-z])\s*=\s*(\\frac[\s\S]*$|\\sum[\s\S]*$|\\int[\s\S]*$)/gm;

  return content.replace(standaloneEquationPattern, (match) => {
    // Skip if it's already wrapped in math delimiters
    if (match.startsWith("$") || match.startsWith("\\(")) return match;

    // Clean any internal math delimiters
    const cleanedMatch = match.replace(/\$([^$]+)\$/g, "\\text{$1}");

    // Wrap in math delimiters
    return `$${cleanedMatch}$`;
  });
};

/**
 * Comprehensive preprocessor for LaTeX expressions in markdown
 * @param {string} text - The markdown text to process
 * @returns {string} Processed text with all LaTeX expressions properly formatted
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

      let processedSegment = segment;

      // 1. Handle common equation patterns (variable = expression)
      const equationPatterns = [
        // L = expression pattern (common in ML/stats)
        /([A-Za-z](?:\([^)]*\))?\s*=\s*)(\\frac|\\sum|\\prod|\\int|\\lim|\\sup|\\inf|\\max|\\min)[\s\S]*?(?=\n\n|\n[A-Z]|$)/g,

        // Equation with numbered reference (common in academic papers)
        /([A-Za-z][^\n=]*?=\s*(?:.*?))(\([\d.]+\))$/gm,

        // Multi-line equation blocks
        /^(\\begin\{(?:equation|align|gather|eqnarray)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|eqnarray)\*?\})$/gm,

        // Standalone LaTeX expressions starting with common commands
        /^(\\frac|\\sum|\\prod|\\int|\\lim|\\sup|\\inf|\\max|\\min)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gm,
      ];

      // Process each equation pattern
      equationPatterns.forEach((pattern) => {
        processedSegment = processedSegment.replace(pattern, (match) => {
          // Skip if already in math delimiters
          if (match.startsWith("$") || match.startsWith("\\(")) return match;

          // Clean internal dollar signs
          const cleanedMatch = match.replace(/\$([^$]+)\$/g, "\\text{$1}");

          // Wrap in math delimiters
          return `$${cleanedMatch}$`;
        });
      });

      // 2. Handle parenthesized LaTeX (already in your code)
      const latexPattern =
        /\(([^()]*?(?:\([^()]*\)[^()]*?)*?(?:\\[a-zA-Z]+{.*?}|\^|_|\\frac|\\sqrt|\\sum|\\int|\\lim).*?)\)/g;

      processedSegment = processedSegment.replace(
        latexPattern,
        (match, latexContent) => {
          if (latexContent.match(/\\[a-zA-Z]+|[\^_]|\{|\}/)) {
            // Clean internal dollar signs
            const cleanedLatex = latexContent.replace(
              /\$([^$]+)\$/g,
              "\\text{$1}"
            );
            return `$${cleanedLatex}$`;
          }
          return match;
        }
      );

      // 3. Handle inline math expressions that might be missed
      // Look for patterns like x^2, \alpha, etc. that aren't in delimiters
      const inlineMathPatterns = [
        /\b([a-zA-Z])_([a-zA-Z0-9])\b/g, // Subscripts like x_i
        /\b([a-zA-Z])(?:\^|\*\*)([a-zA-Z0-9])\b/g, // Superscripts like x^2
        /\\[a-zA-Z]+(?:\{[^}]*\})?/g, // LaTeX commands like \alpha
      ];

      inlineMathPatterns.forEach((pattern) => {
        processedSegment = processedSegment.replace(pattern, (match) => {
          // Don't wrap if inside code, already in math, or in URL
          const prevChar = processedSegment.charAt(
            processedSegment.indexOf(match) - 1
          );
          const nextChar = processedSegment.charAt(
            processedSegment.indexOf(match) + match.length
          );

          if (
            prevChar === "`" ||
            nextChar === "`" ||
            prevChar === "$" ||
            nextChar === "$" ||
            prevChar === "/" ||
            prevChar === "."
          ) {
            return match;
          }

          // Wrap in inline math delimiters
          return `$${match}$`;
        });
      });

      return processedSegment;
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

    const sanitizedValue = cleanValue.replace(/([ŷŵǔǚńḿǹ])/g, "\\text{$1}");

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
    } else if (contentWithoutRef.startsWith("y:")) {
      // Handle the case where it's just a score starting with y:
      // Remove $ at the end
      urlPart = "";
      restPart = contentWithoutRef.replace(/\$(\s*)$/, "$1");
    } else {
      // Handle non-URL case - it could be a filename with score
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
          <span className="text-[15px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 whitespace-nowrap">
            RREF {reference.number + 1}
          </span>
          <div className="text-[15px] font-bold truncate text-gray-700 dark:text-gray-300">
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
const ReferencesSection = ({ content }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Parse references from content
  const references = useMemo(() => {
    if (!content) return [];

    // Extract references in format [RREF#] filename
    const refRegex = /\[RREF(\d+)\].*?(?=\n\[RREF|$)/gs;
    const matches = [...content.matchAll(refRegex)];

    return matches.map((match, index) => ({
      number: index,
      content: match[0].trim(),
    }));
  }, [content]);

  if (references.length === 0) return null;

  return (
    <div className="mt-8 border rounded-xl border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            References
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({references.length})
          </span>
        </div>
      </div>
      <div>
        {references.map((ref) => (
          <ReferenceItem key={ref.number} reference={ref} />
        ))}
      </div>
    </div>
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

    // First, apply standard LaTeX preprocessing
    let processed = convertParenthesesLatex
      ? preprocessLatex(children)
      : children;

    // Then handle standalone LaTeX equations like "L = \frac{...}"
    processed = processStandaloneLatex(processed);

    return processed;
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
