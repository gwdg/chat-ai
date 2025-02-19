/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import katex from "katex";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import Code from "./Code";
import "katex/dist/katex.min.css";
import { forwardRef, useImperativeHandle } from "react";
import ErrorBoundary from "./ErrorBoundary";

// KaTeX configuration options
const katexOptions = {
  strict: false,
  throwOnError: false,
  displayMode: false,
  output: "html",
  trust: true,
  macros: {},
};

// Function to preprocess LaTeX in parentheses
const preprocessLatex = (text) => {
  if (!text) return "";

  let conversionCount = 0;

  const segments = text.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return segments
    .map((segment, index) => {
      if (segment.startsWith("```") || segment.startsWith("`")) {
        return segment;
      }

      const latexPattern =
        /\(([^()]*?(?:\([^()]*\)[^()]*?)*?(?:\\[a-zA-Z]+{.*?}|\^|_|\\frac|\\sqrt|\\sum|\\int|\\lim).*?)\)/g;

      return segment.replace(latexPattern, (match, latexContent) => {
        if (latexContent.match(/\\[a-zA-Z]+|[\^_]|\{|\}/)) {
          conversionCount++;
          return `$${latexContent}$`;
        }
        return match;
      });
    })
    .join("");
};

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

const ReferenceItem = forwardRef((props, ref) => {
  const { reference, isExpanded } = props;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(isExpanded);
  }, [isExpanded]);

  useImperativeHandle(ref, () => setIsOpen);

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
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/30">
          <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300">
            {reference.content}
          </pre>
        </div>
      )}
    </div>
  );
});

ReferenceItem.displayName = "ReferenceItem";

const ReferencesSection = ({ content }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [allExpanded, setAllExpanded] = useState(false);
  const itemRefs = useRef(new Map());

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

  const toggleAll = () => {
    setAllExpanded(!allExpanded);
    itemRefs.current.forEach((ref) => ref(!allExpanded));
  };

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
            ref={(toggleFn) => itemRefs.current.set(ref.number, toggleFn)}
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

const ThinkingBlock = ({ children, autoExpand = false }) => {
  const [isOpen, setIsOpen] = useState(autoExpand);
  const contentRef = useRef(null);

  useEffect(() => {
    if (autoExpand && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoExpand, children]);

  return (
    <div className="my-4 rounded-lg border border-tertiary">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full p-3 text-sm bg-blue-50 dark:bg-blue-900/30 rounded-t-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Brain size={16} className="ml-2 mr-2" />
        <span>Thinking Process</span>
      </button>
      {isOpen && (
        <div
          ref={contentRef}
          className="p-3 text-sm bg-blue-50/50 dark:bg-blue-900/20 rounded-b-lg"
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={components}
          >
            {children}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

const MarkdownRenderer = ({
  children,
  isDarkMode,
  isLoading,
  convertParenthesesLatex = true, // New prop to control parentheses conversion
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);

  // Process the content before rendering
  const processedContent = useMemo(() => {
    if (!children) return "";
    return convertParenthesesLatex ? preprocessLatex(children) : children;
  }, [children, convertParenthesesLatex]);

  useEffect(() => {
    if (!processedContent || !isLoading) {
      setDisplayedText("");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
      processedIndexRef.current = 0;
      return;
    }

    const processNextChar = () => {
      if (processedIndexRef.current >= processedContent.length) return;

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
      setTimeout(processNextChar, 10);
    };

    processNextChar();
  }, [processedContent, isLoading]);

  if (!processedContent) return null;

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
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
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
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
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
