import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import katex from "katex";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import Code from "./Code";
import "katex/dist/katex.min.css";

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
      </div>
    );
  }

  const parts = children.split(/(<think>|<\/think>)/);
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
    </div>
  );
};

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
