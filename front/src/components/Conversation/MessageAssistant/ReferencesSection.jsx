import React, { useState, memo, useMemo, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { rendererComponents, SafeMarkdown } from "./MarkdownRenderer";
import { parseReferences } from "./parseReferences";

const ProgressiveReferenceItem = memo(function ProgressiveReferenceItem({
  reference,
  index,
  isVisible,
  isComplete,
  isStreaming,
  onRenderComplete,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isVisible && !isRendered) {
      const t = setTimeout(() => {
        setIsRendered(true);
        onRenderComplete?.(index);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isVisible, isRendered, index, onRenderComplete]);

  const { titleText, contentBody, hasContent, isPartial } = useMemo(() => {
    const raw = reference?.content || "";
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const firstLine = lines[0] || "";

    const title =
      reference?.title ||
      firstLine.replace(/\s*\[RREF\d+\]\s*/i, "").trim() ||
      `Reference ${reference?.rrefNumber ?? index + 1}`;

    const body = lines.slice(1).join("\n").trim();
    const partialFlag =
      isStreaming && !isComplete && (raw.length < 50 || !raw.includes("\n"));

    return {
      titleText: title,
      contentBody: body,
      hasContent: body.length > 0 || partialFlag,
      isPartial: partialFlag,
    };
  }, [reference, index, isStreaming, isComplete]);

  const copyReference = useCallback(
    async (e) => {
      e.stopPropagation();
      try {
        const text = contentBody ? `${titleText}\n\n${contentBody}` : titleText;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch {}
    },
    [titleText, contentBody]
  );

  const canExpand = hasContent && isRendered && !isPartial;

  if (!isVisible) return null;

  return (
    <div
      className={`border-l-4 border-l-blue-500/30 hover:border-l-blue-500 transition-all duration-500 ${
        isRendered ? "opacity-100" : "opacity-0"
      } animate-in slide-in-from-left-2`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div
        className={`w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between group transition-colors duration-200 ${
          canExpand ? "cursor-pointer" : "cursor-default"
        }`}
        onClick={canExpand ? () => setIsOpen((o) => !o) : undefined}
        aria-expanded={canExpand ? isOpen : undefined}
        aria-controls={
          canExpand ? `reference-${reference?.rrefNumber || index}` : undefined
        }
      >
        <div className="flex items-center gap-3 flex-grow overflow-hidden min-w-0">
          <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full whitespace-nowrap">
            {reference?.rrefNumber || index + 1}
          </span>

          <div className="text-sm font-medium truncate flex items-center gap-2 min-w-0">
            <div className="truncate">
              <SafeMarkdown>{titleText}</SafeMarkdown>
            </div>

            {reference?.url && (
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 shrink-0"
                onClick={(e) => e.stopPropagation()}
                title="Open source"
              >
                <ExternalLink size={16} className="opacity-70" />
              </a>
            )}

            {isPartial && isStreaming && (
              <span className="inline-flex items-center ml-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">
                  loading...
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 ml-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {hasContent && isRendered && !isPartial && (
            <button
              onClick={copyReference}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
              title="Copy reference"
            >
              {copied ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <Copy size={14} className="text-gray-500" />
              )}
            </button>
          )}
          {canExpand ? (
            <div className="transition-transform duration-200">
              {isOpen ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </div>
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>
      </div>

      {isOpen && hasContent && contentBody && !isPartial && (
        <div
          id={`reference-${reference?.rrefNumber || index}`}
          className="overflow-hidden"
        >
          <div className="px-4 py-4 bg-gray-50 dark:bg-gray-800/30 border-t animate-in slide-in-from-top-2 duration-300">
            <div className="leading-relaxed">
              <SafeMarkdown components={rendererComponents}>
                {contentBody}
              </SafeMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const ReferencesSection = memo(function ReferencesSection({
  content,
  isLoading,
  isStreaming = false,
}) {
  const [visibleRefs, setVisibleRefs] = useState(0);
  const [completedRefs, setCompletedRefs] = useState(new Set());
  const [copiedAll, setCopiedAll] = useState(false);

  const references = useMemo(() => {
    try {
      if (!content) return [];
      return parseReferences(content); // returns RAW markdown blocks
    } catch (e) {
      console.error("Error parsing references:", e);
      return [];
    }
  }, [content]);

  useEffect(() => {
    if (references.length > 0) {
      if (isStreaming) {
        const currentVisible = Math.min(references.length, visibleRefs || 1);
        if (currentVisible !== visibleRefs) setVisibleRefs(currentVisible);
      } else {
        setVisibleRefs(references.length);
      }
    }
  }, [references.length, isStreaming, visibleRefs]);

  const handleReferenceRenderComplete = useCallback(
    (index) => {
      setCompletedRefs((prev) => new Set([...prev, index]));
      if (
        isStreaming &&
        index + 1 < references.length &&
        visibleRefs <= index + 1
      ) {
        setTimeout(() => setVisibleRefs((prev) => prev + 1), 200);
      }
    },
    [isStreaming, references.length, visibleRefs]
  );

  const allReferencesText = useMemo(
    () =>
      references
        .map((ref) => {
          const t = ref.title || `Reference ${ref.rrefNumber}`;
          const body = (ref.content || "")
            .split("\n")
            .slice(1)
            .join("\n")
            .trim();
          return body ? `${t}\n\n${body}` : t;
        })
        .join("\n\n"),
    [references]
  );

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(allReferencesText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1600);
    } catch {}
  }, [allReferencesText]);

  if (!references || references.length === 0) return null;

  const isFullyLoaded = !isLoading && !isStreaming;
  const visibleCount = Math.min(visibleRefs, references.length);

  return (
    <div className="mt-12 animate-in fade-in-50 duration-700 slide-in-from-bottom-4">
      <div className="mb-8">
        <div className="relative w-full flex items-center">
          {/* Left line */}
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />

          {/* Center content */}
          <div className="flex items-center gap-3 px-4">
            <div
              className={`w-2 h-2 rounded-full ${
                isStreaming ? "bg-blue-500 animate-pulse" : "bg-green-500"
              }`}
            />
            <span className="text-sm font-semibold uppercase tracking-wider">
              Sources & References
            </span>
            <div
              className={`w-2 h-2 rounded-full ${
                isStreaming ? "bg-blue-500 animate-pulse" : "bg-green-500"
              }`}
            />
          </div>

          {/* Right line */}
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
        </div>
      </div>

      <div className="border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">References</span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
                {visibleCount} of {references.length} source
                {references.length !== 1 ? "s" : ""}
              </span>
              {isStreaming && (
                <span className="text-sm text-blue-600/70 dark:text-blue-400/70 animate-pulse">
                  Streaming...
                </span>
              )}
            </div>

            <button
              onClick={copyAll}
              disabled={!isFullyLoaded || references.length === 0}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                isFullyLoaded && references.length > 0
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md cursor-pointer"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
              aria-label="Copy all references"
              title={
                isFullyLoaded && references.length > 0
                  ? "Copy all references to clipboard"
                  : "Wait for references to load"
              }
            >
              {copiedAll ? <Check size={16} /> : <Copy size={16} />}
              {copiedAll ? "Copied!" : "Copy All"}
            </button>
          </div>
        </div>

        <div>
          {references.map((ref, index) => (
            <ProgressiveReferenceItem
              key={`ref-${ref.rrefNumber}-${index}`}
              reference={ref}
              index={index}
              isVisible={index < visibleCount}
              isComplete={!isStreaming || completedRefs.has(index)}
              isStreaming={isStreaming}
              onRenderComplete={handleReferenceRenderComplete}
            />
          ))}

          {isStreaming &&
            references.length > 0 &&
            visibleCount < references.length && (
              <div className="px-6 py-4 text-center border-t">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">
                    Loading references... ({visibleCount}/{references.length})
                  </span>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
});

export default ReferencesSection;
