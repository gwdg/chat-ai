import { useState, useEffect, useRef, useMemo, memo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { rendererComponents } from "./MarkdownRenderer";
import CopyButton from "./CopyButton";
import { selectCollapseReasoningWhileStreaming } from "../../../Redux/reducers/userSettingsReducer";

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

const WORD_SEGMENTER =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : null;

const countWords = (value) => {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (WORD_SEGMENTER) {
    let count = 0;
    for (const segment of WORD_SEGMENTER.segment(text)) {
      if (segment.isWordLike) count += 1;
    }
    return count;
  }
  return text.split(/\s+/).filter(Boolean).length;
};

const ThinkingBlock = memo(
  ({ children, autoExpand = false, isStreaming = false, renderContent }) => {
    const collapseWhileStreaming = useSelector(
      selectCollapseReasoningWhileStreaming
    );
    const [isOpen, setIsOpen] = useState(
      autoExpand && isStreaming && !collapseWhileStreaming
    );
    const [autoOpened, setAutoOpened] = useState(
      autoExpand && isStreaming && !collapseWhileStreaming
    );
    const contentRef = useRef(null);
    const { t } = useTranslation();
    const [userOverride, setUserOverride] = useState(false);
    const wordCount = useMemo(
      () => countWords(String(children || "")),
      [children],
    );

    // Auto-open while the model is still "thinking", then collapse once done.
    // With the preference enabled, keep the box closed during streaming and show
    // a live word count instead. A click always wins over the automatic behavior.
    useEffect(() => {
      if (userOverride) return;
      if (isStreaming && collapseWhileStreaming) {
        setIsOpen(false);
        setAutoOpened(false);
      } else if (autoExpand && isStreaming) {
        setIsOpen(true);
        setAutoOpened(true);
      } else if (!isStreaming && autoOpened) {
        setIsOpen(false);
        setAutoOpened(false);
      }
    }, [autoExpand, isStreaming, autoOpened, collapseWhileStreaming, userOverride]);

    // The override only applies to the current streaming turn. When streaming
    // ends, keep whatever the user chose and let the next turn auto-behave again.
    useEffect(() => {
      if (!isStreaming) setUserOverride(false);
    }, [isStreaming]);

    return (
      <div className="my-1 rounded-lg border border-accent">
        <div className="flex items-center w-full rounded-t-lg text-xs bg-info/10">
          <button
            onClick={() => {
              setUserOverride(true);
              setIsOpen((open) => !open);
              setAutoOpened(false);
            }}
            className="cursor-pointer flex flex-1 items-center px-2 py-1 rounded-tl-lg hover:bg-info/20"
            aria-expanded={isOpen}
            aria-controls="thinking-content"
          >
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Brain size={14} className="ml-1.5 mr-1.5" />
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Trans i18nKey="conversation.reasoning" />
              {isStreaming && !isOpen && (
                <>
                  <span
                    className="sr-only"
                    role="status"
                    aria-label={t("conversation.reasoning_streaming")}
                  />
                  <span
                    aria-hidden="true"
                    className="reasoning-streaming-status flex flex-wrap items-baseline gap-x-1 text-accent tabular-nums"
                  >
                    <span>{t("conversation.reasoning_streaming_label")},</span>
                    <span>
                      {t("conversation.reasoning_received_words", {
                        count: wordCount,
                      })}
                    </span>
                  </span>
                </>
              )}
            </span>
          </button>
          <div className="shrink-0 pr-2">
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
            className="px-2.5 py-1.5 text-xs bg-info/5 rounded-b-lg"
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
