import { useState, useEffect, useRef, memo } from "react";
import { Trans, useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { rendererComponents } from "./MarkdownRenderer";
import CopyButton from "./CopyButton";

// Models often draft raw HTML while reasoning. Rendering that as live markup let
// injected <iframe>/<style> tags hit the network and restyle the whole page, so
// show raw HTML as literal text instead. Code fences are untouched: fenced and
// inline code are their own mdast node types, never "html".
const remarkHtmlAsText = () => (tree) => {
  const visit = (node) => {
    if (!Array.isArray(node.children)) return;
    node.children.forEach((child, i) => {
      if (child.type === "html") {
        node.children[i] = { type: "text", value: child.value };
      } else {
        visit(child);
      }
    });
  };
  visit(tree);
};

const ThinkingBlock = memo(
  ({ children, autoExpand = false, isStreaming = false, renderContent }) => {
    const [isOpen, setIsOpen] = useState(autoExpand && isStreaming);
    const [autoOpened, setAutoOpened] = useState(autoExpand && isStreaming);
    const contentRef = useRef(null);
    const { t } = useTranslation();

    // Auto-open while the model is still "thinking", then collapse once done unless
    // the user has explicitly toggled it.
    useEffect(() => {
      if (autoExpand && isStreaming) {
        setIsOpen(true);
        setAutoOpened(true);
      } else if (!isStreaming && autoOpened) {
        setIsOpen(false);
        setAutoOpened(false);
      }
    }, [autoExpand, isStreaming, autoOpened]);

    return (
      <div className="my-4 rounded-lg border border-accent">
        <div className="flex items-center w-full rounded-t-lg text-xs bg-info/10">
          <button
            onClick={() => {
              if (!isStreaming) {
                setIsOpen(!isOpen);
                setAutoOpened(false);
              }
            }}
            className="cursor-pointer flex flex-1 items-center p-3 rounded-tl-lg hover:bg-info/20 disabled:opacity-70"
            aria-expanded={isOpen}
            aria-controls="thinking-content"
            disabled={isStreaming}
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Brain size={16} className="ml-2 mr-2" />
            <span className="flex items-center gap-2"><Trans i18nKey="conversation.reasoning" /></span>
          </button>
          <div className="shrink-0 pr-3">
            <CopyButton
              text={children || ""}
              title={t("conversation.copy_reasoning")}
            />
          </div>
        </div>
        {isOpen && (
          <div
            id="thinking-content"
            ref={contentRef}
            className="p-3 text-xs bg-info/5 rounded-b-lg"
            aria-live="polite"
            aria-busy={isStreaming ? "true" : "false"}
          >
            {renderContent ? (
              renderContent(children || "")
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkHtmlAsText]}
                components={rendererComponents}
              >
                {children || ""}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    );
  }
);

ThinkingBlock.displayName = "ThinkingBlock";

export default ThinkingBlock;
