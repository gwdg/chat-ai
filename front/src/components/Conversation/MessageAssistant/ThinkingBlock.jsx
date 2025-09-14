import { useState, useEffect, useRef, memo } from "react";
import { Trans } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { rendererComponents } from "./MarkdownRenderer";

const ThinkingBlock = memo(
  ({ children, autoExpand = false, isStreaming = false }) => {
    const [isOpen, setIsOpen] = useState(autoExpand);
    const contentRef = useRef(null);

    useEffect(() => {
      if (autoExpand && contentRef.current) {
        contentRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, [autoExpand]);

    return (
      <div className="my-4 rounded-lg border border-tertiary">
        <button
          onClick={() => {
            if (!isStreaming) setIsOpen(!isOpen);
          }}
          className="cursor-pointer flex items-center w-full p-3 text-xs bg-blue-50 dark:bg-blue-900/30 rounded-t-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-70"
          aria-expanded={isOpen}
          aria-controls="thinking-content"
          disabled={isStreaming}
        >
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Brain size={16} className="ml-2 mr-2" />
          <span className="flex items-center gap-2"><Trans i18nKey="conversation.reasoning" /></span>
        </button>
        {isOpen && (
          <div
            id="thinking-content"
            ref={contentRef}
            className="p-3 text-xs bg-blue-50/50 dark:bg-blue-900/20 rounded-b-lg"
            aria-live="polite"
            aria-busy={isStreaming ? "true" : "false"}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={rendererComponents}
            >
              {children || ""}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  }
);

ThinkingBlock.displayName = "ThinkingBlock";

export default ThinkingBlock;
