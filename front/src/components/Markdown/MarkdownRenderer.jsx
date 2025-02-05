/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import katex from "katex";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import Code from "./Code";
import "katex/dist/katex.min.css";
import { forwardRef, useImperativeHandle } from "react";
import ErrorBoundary from "./ErrorBoundary";

const components = {
  code: ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    return inline ? (
      <code
        className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-sm"
        {...props}
      >
        {children}
      </code>
    ) : (
      <Code language={match?.[1]}>{children}</Code>
    );
  },
  math: ({ value }) => {
    try {
      return (
        <span
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(value, { strict: false }),
          }}
        />
      );
    } catch (error) {
      console.error("LaTeX rendering error:", error);
      return <span className="text-red-500">{value}</span>;
    }
  },
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

const MarkdownRenderer = ({ children, isDarkMode, isLoading }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);

  useEffect(() => {
    if (!children || !isLoading) {
      setDisplayedText("");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
      processedIndexRef.current = 0;
      return;
    }

    const processNextChar = () => {
      if (processedIndexRef.current >= children.length) return;

      const char = children[processedIndexRef.current];
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
        setThinkingContent(bufferRef.current);
      }

      processedIndexRef.current++;
      setTimeout(processNextChar, 10);
    };

    processNextChar();
  }, [children, isLoading]);

  if (!children) return null;
  if (isLoading) {
    const [mainContent, referencesContent] = children.split("References:");
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

  const [mainContent, referencesContent] = children.split("References:");
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
