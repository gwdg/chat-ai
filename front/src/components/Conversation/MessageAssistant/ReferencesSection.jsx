import { useState, memo, useMemo, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

// Import shared markdown components
import { rendererComponents } from "./rendererComponents";
// Import utility from separate file
import { parseReferences } from "./parseReferences";

// Convert HTML to readable text instead of removing
const convertHtmlToText = (content) => {
  return content
    .replace(/<meta\s+([^>]*)>/gi, (match, attrs) => {
      return `<meta ${attrs}>`;
    })
    .replace(/<script\s*([^>]*)>(.*?)<\/script>/gi, (match, attrs, content) => {
      return `[SCRIPT${attrs ? ` ${attrs}` : ""}]${
        content ? `: ${content}` : ""
      }[/SCRIPT]`;
    })
    .replace(/<iframe\s*([^>]*)>(.*?)<\/iframe>/gi, (match, attrs, content) => {
      return `[IFRAME${attrs ? ` ${attrs}` : ""}]${content || ""}[/IFRAME]`;
    })
    .replace(/<object\s*([^>]*)>(.*?)<\/object>/gi, (match, attrs, content) => {
      return `[OBJECT${attrs ? ` ${attrs}` : ""}]${content || ""}[/OBJECT]`;
    })
    .replace(/<embed\s*([^>]*)>/gi, (match, attrs) => {
      return `[EMBED${attrs ? ` ${attrs}` : ""}]`;
    })
    .replace(/<form\s*([^>]*)>(.*?)<\/form>/gi, (match, attrs, content) => {
      return `[FORM${attrs ? ` ${attrs}` : ""}]${content || ""}[/FORM]`;
    })
    .replace(/javascript:/gi, "javascript-protocol:")
    .replace(/\son(\w+)\s*=\s*([^>\s]*)/gi, (match, event, handler) => {
      return ` data-on${event}="${handler}"`;
    });
};

// Progressive Reference Item that can show partial content
const ProgressiveReferenceItem = memo(
  ({
    reference,
    index,
    isVisible,
    isComplete,
    isStreaming,
    onRenderComplete,
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isRendered, setIsRendered] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    // Mark as rendered when visible
    useEffect(() => {
      if (isVisible && !isRendered) {
        const timer = setTimeout(() => {
          setIsRendered(true);
          onRenderComplete?.(index);
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [isVisible, isRendered, index, onRenderComplete]);

    // Extract title and content with streaming support
    const { titleText, contentWithoutTitle, hasContent, sourceUrl, isPartial } =
      useMemo(() => {
        try {
          if (!reference?.content) {
            return {
              titleText: `Reference ${(reference?.number || index) + 1}`,
              contentWithoutTitle: "",
              hasContent: false,
              sourceUrl: null,
              isPartial: false,
            };
          }

          const processedContent = convertHtmlToText(reference.content);
          const lines = processedContent
            .split("\n")
            .filter((line) => line.trim());
          const firstLine = lines[0] || "";
          const remainingLines = lines.slice(1);

          // Check if this looks like a partial reference (streaming)
          const isPartial =
            isStreaming &&
            !isComplete &&
            (processedContent.length < 50 || !processedContent.includes("\n"));

          // Clean up the title - remove RREF tag first
          let cleanTitle = firstLine.replace(/\[RREF\d+\]\s*/i, "").trim();

          // Parse markdown-style link [text](url) or just extract URL
          let sourceUrl = null;
          let displayTitle = cleanTitle;

          // Check for markdown link format [text](url)
          const markdownLinkMatch = cleanTitle.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (markdownLinkMatch) {
            // Use the link text as title, extract URL
            displayTitle = markdownLinkMatch[1].trim();
            sourceUrl = markdownLinkMatch[2].trim();
          } else {
            // Check for plain URL in the title
            const urlMatch = cleanTitle.match(/(https?:\/\/[^\s\]]+)/);
            if (urlMatch) {
              sourceUrl = urlMatch[1];
              // If the entire title is just the URL, use domain as title
              if (
                cleanTitle === sourceUrl ||
                cleanTitle === `[${sourceUrl}](${sourceUrl})`
              ) {
                try {
                  const url = new URL(sourceUrl);
                  displayTitle = url.hostname.replace("www.", "");
                } catch {
                  displayTitle = "Source";
                }
              } else {
                // Remove the URL from the title
                displayTitle = cleanTitle.replace(urlMatch[0], "").trim();
              }
            }
          }

          // Check for score in parentheses at the end and remove it
          displayTitle = displayTitle.replace(/\s*\([0-9.]+\)\s*$/, "").trim();

          if (!displayTitle) {
            displayTitle = sourceUrl
              ? "Source"
              : `Reference ${(reference?.number || index) + 1}`;
          }

          // If it's partial and we only have a title, that's okay
          const remainingContent = remainingLines.join("\n").trim();
          const hasActualContent = remainingContent.length > 10 || isPartial;

          return {
            titleText: displayTitle,
            contentWithoutTitle: remainingContent,
            hasContent: hasActualContent,
            sourceUrl,
            isPartial,
          };
        } catch (error) {
          console.error("Error processing reference:", error);
          setHasError(true);
          return {
            titleText: `Reference ${(reference?.number || index) + 1} (Error)`,
            contentWithoutTitle: "",
            hasContent: false,
            sourceUrl: null,
            isPartial: false,
          };
        }
      }, [reference, index, isStreaming, isComplete]);

    // Copy individual reference
    const copyReference = useCallback(
      async (e) => {
        e.stopPropagation();
        try {
          const textToCopy = `${titleText}\n\n${contentWithoutTitle}`;
          await navigator.clipboard.writeText(textToCopy);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
          console.error("Failed to copy reference:", err);
        }
      },
      [titleText, contentWithoutTitle]
    );

    // Safe link renderer
    const linkRenderer = useMemo(
      () => ({
        ...rendererComponents,
        a: ({ href, children, ...props }) => {
          try {
            if (
              href &&
              (href.startsWith("javascript:") || href.includes("javascript:"))
            ) {
              return (
                <span className="text-gray-600 line-through">
                  {children} [UNSAFE LINK]
                </span>
              );
            }

            return (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {children}
                <ExternalLink size={12} className="opacity-60" />
              </a>
            );
          } catch (error) {
            console.error("Error rendering link:", error);
            return <span className="text-blue-600">{children}</span>;
          }
        },
      }),
      []
    );

    const handleToggle = useCallback(() => {
      try {
        // Allow toggle if we have content and it's complete (not partial)
        if (hasContent && isRendered && !isPartial) {
          setIsOpen(!isOpen);
        }
      } catch (error) {
        console.error("Error toggling reference:", error);
        setHasError(true);
      }
    }, [hasContent, isRendered, isPartial, isOpen]);

    // Safe markdown rendering
    const SafeMarkdown = ({ children: markdownContent, ...props }) => {
      try {
        if (!markdownContent || typeof markdownContent !== "string") {
          return null;
        }

        // First, neutralize any meta refresh tags completely
        let sanitizedContent = markdownContent
          // Remove meta refresh tags entirely
          .replace(
            /<meta\s+[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
            "[META REFRESH REMOVED]"
          )
          // Escape other potentially dangerous meta tags
          .replace(/<meta\s+([^>]*)>/gi, (match, attrs) => {
            return `\\<meta ${attrs}\\>`;
          })
          // Continue with other sanitization...
          .replace(
            /<script\s*([^>]*)>(.*?)<\/script>/gi,
            (match, attrs, content) => {
              return `\\<script${attrs ? ` ${attrs}` : ""}\\>${
                content ? content : ""
              }\\</script\\>`;
            }
          )
          .replace(
            /<iframe\s*([^>]*)>(.*?)<\/iframe>/gi,
            (match, attrs, content) => {
              return `\\<iframe${attrs ? ` ${attrs}` : ""}\\>${
                content || ""
              }\\</iframe\\>`;
            }
          )
          .replace(
            /<object\s*([^>]*)>(.*?)<\/object>/gi,
            (match, attrs, content) => {
              return `\\<object${attrs ? ` ${attrs}` : ""}\\>${
                content || ""
              }\\</object\\>`;
            }
          )
          .replace(/<embed\s*([^>]*)>/gi, (match, attrs) => {
            return `\\<embed${attrs ? ` ${attrs}` : ""}\\>`;
          })
          .replace(
            /<form\s*([^>]*)>(.*?)<\/form>/gi,
            (match, attrs, content) => {
              return `\\<form${attrs ? ` ${attrs}` : ""}\\>${
                content || ""
              }\\</form\\>`;
            }
          )
          .replace(/javascript:/gi, "javascript-protocol:")
          .replace(
            /\son(\w+)\s*=\s*["']([^"']+)["']/gi,
            (match, event, handler) => {
              return ` data-on${event}="${handler}"`;
            }
          );

        //return <ReactMarkdown {...props}>{sanitizedContent}</ReactMarkdown>;
        return (
          <div {...props}>
            <ReactMarkdown>{sanitizedContent}</ReactMarkdown>
          </div>
        );
      } catch (error) {
        console.error("Error rendering markdown:", error);
        return (
          <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            Error rendering content: {error.message}
          </div>
        );
      }
    };

    if (!isVisible) {
      return null;
    }

    if (hasError) {
      return (
        <div className="border-l-4 border-l-red-500/50 px-4 py-3 bg-red-50 dark:bg-red-900/20 animate-in slide-in-from-left-2 duration-300">
          <div className="text-sm text-red-600 dark:text-red-400">
            Error rendering reference {(reference?.number || index) + 1}
          </div>
        </div>
      );
    }

    const opacity = isRendered ? "opacity-100" : "opacity-0";
    const canExpand = hasContent && isRendered && !isPartial;

    return (
      <div
        className={`border-l-4 border-l-blue-500/30 hover:border-l-blue-500 transition-all duration-500 ${opacity} animate-in slide-in-from-left-2`}
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div
          className={`w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between group transition-colors duration-200 ${
            canExpand ? "cursor-pointer" : "cursor-default"
          }`}
          onClick={canExpand ? handleToggle : undefined}
          aria-expanded={canExpand ? isOpen : undefined}
          aria-controls={
            canExpand ? `reference-${reference?.number || index}` : undefined
          }
        >
          <div className="flex items-center gap-3 flex-grow overflow-hidden min-w-0">
            <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full whitespace-nowrap">
              {(reference?.number || index) + 1}
            </span>
            <div className="text-sm font-medium truncate text-gray-800 dark:text-gray-200 flex-grow min-w-0">
              <SafeMarkdown
                remarkplugins={[remarkGfm]}
                rehypeplugins={[rehypeRaw]}
                SafeMarkdown
                components={linkRenderer}
                className="inline"
              >
                {titleText}
              </SafeMarkdown>
              {isPartial && isStreaming && (
                <span className="inline-flex items-center ml-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">
                    loading...
                  </span>
                </span>
              )}
            </div>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 opacity-70 hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                title="Open source"
              >
                <ExternalLink size={18} />
              </a>
            )}
          </div>

          <div className="shrink-0 ml-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {hasContent && isRendered && !isPartial && (
              <button
                onClick={copyReference}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
                title="Copy reference"
              >
                {copySuccess ? (
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

        {/* Expanded content */}
        {isOpen && hasContent && contentWithoutTitle && !isPartial && (
          <div
            id={`reference-${reference?.number || index}`}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
              <SafeMarkdown
                remarkplugins={[remarkGfm]}
                rehypeplugins={[rehypeRaw]}
                components={linkRenderer}
                className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
              >
                {contentWithoutTitle}
              </SafeMarkdown>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ProgressiveReferenceItem.displayName = "ProgressiveReferenceItem";

// Enhanced ReferencesSection with progressive streaming support
const ReferencesSection = memo(
  ({ content, isLoading, isStreaming = false }) => {
    const [copySuccess, setCopySuccess] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [visibleRefs, setVisibleRefs] = useState(0);
    const [completedRefs, setCompletedRefs] = useState(new Set());

    // Parse references with progressive support
    const references = useMemo(() => {
      try {
        if (!content) return [];

        const refs = parseReferences(content);
        return refs.sort((a, b) => {
          const numA = a.number !== undefined ? a.number : 999;
          const numB = b.number !== undefined ? b.number : 999;
          return numA - numB;
        });
      } catch (error) {
        console.error("Error in ReferencesSection parsing:", error);
        setHasError(true);
        return [];
      }
    }, [content]);

    // Progressive rendering logic
    useEffect(() => {
      if (references.length > 0) {
        if (isStreaming) {
          // During streaming, show references as they become available
          const currentVisibleCount = Math.min(
            references.length,
            visibleRefs || 1
          );
          if (currentVisibleCount !== visibleRefs) {
            setVisibleRefs(currentVisibleCount);
          }
        } else {
          // When not streaming, show all references immediately
          setVisibleRefs(references.length);
        }
      }
    }, [references.length, isStreaming, visibleRefs]);

    // Handle individual reference completion
    const handleReferenceRenderComplete = useCallback(
      (index) => {
        setCompletedRefs((prev) => new Set([...prev, index]));

        // Show next reference after a short delay (only during streaming)
        if (
          isStreaming &&
          index + 1 < references.length &&
          visibleRefs <= index + 1
        ) {
          setTimeout(() => {
            setVisibleRefs((prev) => prev + 1);
          }, 200);
        }
      },
      [isStreaming, references.length, visibleRefs]
    );

    // Concatenate all references for copying
    const allReferencesText = useMemo(() => {
      try {
        return references
          .map((ref, index) => {
            if (!ref?.content) return "";
            const processedContent = convertHtmlToText(ref.content);
            return `[${index + 1}] ${processedContent}`;
          })
          .join("\n\n");
      } catch (error) {
        console.error("Error concatenating references:", error);
        return "";
      }
    }, [references]);

    // Copy all references to clipboard
    const copyAllReferences = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(allReferencesText);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error("Failed to copy references:", err);
      }
    }, [allReferencesText]);

    // Error state
    if (hasError) {
      return (
        <div className="mt-8 border rounded-xl border-red-200 dark:border-red-700 overflow-hidden animate-in fade-in-50 duration-300">
          <div className="px-4 py-3 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300">
            ⚠️ Error processing references
          </div>
        </div>
      );
    }

    // No references to show
    if (!references || references.length === 0) {
      return null;
    }

    const isFullyLoaded = !isLoading && !isStreaming;
    const visibleCount = Math.min(visibleRefs, references.length);

    return (
      <div className="mt-12 animate-in fade-in-50 duration-700 slide-in-from-bottom-4">
        {/* Enhanced visual separator */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center">
              <div className="bg-white dark:bg-gray-900 px-6 py-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isStreaming ? "bg-blue-500 animate-pulse" : "bg-green-500"
                    }`}
                  ></div>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Sources & References
                  </span>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isStreaming ? "bg-blue-500 animate-pulse" : "bg-green-500"
                    }`}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced references container */}
        <div className="border rounded-2xl border-gray-200 dark:border-gray-700 overflow-hidden bg-gradient-to-b from-gray-50/50 to-gray-100/50 dark:from-gray-800/30 dark:to-gray-900/30 shadow-sm">
          {/* Enhanced header - always shows nice styling */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-b border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isStreaming ? "bg-blue-500 animate-pulse" : "bg-green-500"
                    }`}
                  ></div>
                  <span className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                    References
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {references.length > 0 ? (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
                      {visibleCount} of {references.length} source
                      {references.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-full">
                      Loading sources...
                    </span>
                  )}
                  {isStreaming && (
                    <span className="text-sm text-blue-600/70 dark:text-blue-400/70 animate-pulse">
                      Streaming...
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyAllReferences}
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
                  {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                  {copySuccess ? "Copied!" : "Copy All"}
                </button>
              </div>
            </div>
          </div>

          {/* Progressive References List */}
          <div className="bg-white dark:bg-gray-900">
            {references.length === 0 && isStreaming ? (
              // Show loading state when no references parsed yet
              <div className="px-6 py-8 text-center">
                <div className="flex items-center justify-center gap-3 text-blue-600 dark:text-blue-400">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">
                    Loading references...
                  </span>
                </div>
              </div>
            ) : (
              references.map((ref, index) => (
                <ProgressiveReferenceItem
                  key={`ref-${
                    ref?.number !== undefined ? ref.number : index
                  }-${index}`}
                  reference={ref}
                  index={index}
                  isVisible={index < visibleCount}
                  isComplete={!isStreaming || completedRefs.has(index)}
                  isStreaming={isStreaming}
                  onRenderComplete={handleReferenceRenderComplete}
                />
              ))
            )}

            {/* Streaming indicator */}
            {isStreaming &&
              references.length > 0 &&
              visibleCount < references.length && (
                <div className="px-6 py-4 text-center border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
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
  }
);

ReferencesSection.displayName = "ReferencesSection";

export default ReferencesSection;
