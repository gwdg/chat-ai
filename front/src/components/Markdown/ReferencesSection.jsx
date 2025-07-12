import { useState, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ChevronDown, ChevronRight } from "lucide-react";

// Import shared markdown components
import { rendererComponents } from "./rendererComponents";
// Import utility from separate file
import { parseReferences } from "./parseReferences";

// ReferenceItem component - handles individual references safely
const ReferenceItem = memo(({ reference, index }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Extract title and content safely with HTML sanitization
  const { titleText, contentWithoutTitle, hasContent } = useMemo(() => {
    try {
      if (!reference?.content) {
        return {
          titleText: `Reference ${(reference?.number || index) + 1}`,
          contentWithoutTitle: "",
          hasContent: false,
        };
      }

      // Sanitize the entire reference content first
      const sanitizedContent = reference.content
        // Remove meta tags (especially refresh tags)
        .replace(/<meta[^>]*>/gi, "[META TAG REMOVED]")
        // Remove script tags
        .replace(/<script[^>]*>.*?<\/script>/gi, "[SCRIPT REMOVED]")
        // Remove other potentially dangerous HTML
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "[IFRAME REMOVED]")
        .replace(/<object[^>]*>.*?<\/object>/gi, "[OBJECT REMOVED]")
        .replace(/<embed[^>]*>/gi, "[EMBED REMOVED]")
        .replace(/<form[^>]*>.*?<\/form>/gi, "[FORM REMOVED]")
        // Remove javascript: links
        .replace(/javascript:/gi, "")
        // Remove on* event handlers
        .replace(/\son\w+\s*=\s*[^>]*/gi, "");

      const lines = sanitizedContent.split("\n");
      const firstLine = lines[0] || "";
      const remainingLines = lines.slice(1);

      // Clean up the title - remove RREF pattern
      let cleanTitle = firstLine.replace(/\[RREF\d+\]\s*/i, "").trim();
      if (!cleanTitle) {
        cleanTitle = `Reference ${(reference?.number || index) + 1}`;
      }

      // Check if there's actual content beyond the title
      const remainingContent = remainingLines.join("\n").trim();
      const hasActualContent = remainingContent.length > 0;

      return {
        titleText: cleanTitle,
        contentWithoutTitle: remainingContent,
        hasContent: hasActualContent,
      };
    } catch (error) {
      console.error("Error processing reference:", error);
      setHasError(true);
      return {
        titleText: `Reference ${(reference?.number || index) + 1} (Error)`,
        contentWithoutTitle: "",
        hasContent: false,
      };
    }
  }, [reference, index]);

  // Safe link renderer
  const linkRenderer = useMemo(
    () => ({
      ...rendererComponents,
      a: ({ href, children, ...props }) => {
        try {
          return (
            <a
              {...props}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
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

  const handleToggle = () => {
    try {
      if (hasContent) {
        setIsOpen(!isOpen);
      }
    } catch (error) {
      console.error("Error toggling reference:", error);
      setHasError(true);
    }
  };

  // Safe markdown rendering function with HTML sanitization
  const SafeMarkdown = ({ children: markdownContent, ...props }) => {
    try {
      if (!markdownContent || typeof markdownContent !== "string") {
        return <span>Invalid content</span>;
      }

      // Sanitize content to prevent HTML injection and page refreshes
      const sanitizedContent = markdownContent
        // Remove meta tags (especially refresh tags)
        .replace(/<meta[^>]*>/gi, "")
        // Remove script tags
        .replace(/<script[^>]*>.*?<\/script>/gi, "")
        // Remove other potentially dangerous HTML
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "")
        .replace(/<object[^>]*>.*?<\/object>/gi, "")
        .replace(/<embed[^>]*>/gi, "")
        .replace(/<form[^>]*>.*?<\/form>/gi, "")
        // Remove javascript: links
        .replace(/javascript:/gi, "")
        // Remove on* event handlers
        .replace(/\son\w+\s*=\s*[^>]*/gi, "");

      return <ReactMarkdown {...props}>{sanitizedContent}</ReactMarkdown>;
    } catch (error) {
      console.error("Error rendering markdown in reference:", error);
      return <span className="text-gray-500">Content rendering error</span>;
    }
  };

  if (hasError) {
    return (
      <div className="border-l-4 border-l-red-500/50 px-4 py-3 bg-red-50 dark:bg-red-900/20">
        <div className="text-sm text-red-600 dark:text-red-400">
          Error rendering reference {(reference?.number || index) + 1}
        </div>
      </div>
    );
  }

  return (
    <div className="border-l-4 border-l-blue-500/50 hover:border-l-blue-500 transition-colors">
      <div
        className={`w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between group ${
          hasContent ? "cursor-pointer" : "cursor-default"
        }`}
        onClick={hasContent ? handleToggle : undefined}
        aria-expanded={hasContent ? isOpen : undefined}
        aria-controls={
          hasContent ? `reference-${reference?.number || index}` : undefined
        }
      >
        <div className="flex items-center gap-2 flex-grow overflow-hidden">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 whitespace-nowrap">
            RREF {(reference?.number || index) + 1}
          </span>
          <div className="text-sm font-bold truncate text-gray-700 dark:text-gray-300">
            <SafeMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={linkRenderer}
              className="inline"
            >
              {titleText}
            </SafeMarkdown>
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {hasContent ? (
            isOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </div>
      </div>
      {isOpen && hasContent && contentWithoutTitle && (
        <div
          id={`reference-${reference?.number || index}`}
          className="px-4 py-3 bg-gray-50 dark:bg-gray-800/30"
        >
          <SafeMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={linkRenderer}
          >
            {contentWithoutTitle}
          </SafeMarkdown>
        </div>
      )}
    </div>
  );
});

ReferenceItem.displayName = "ReferenceItem";

// Main ReferencesSection component
const ReferencesSection = memo(({ content }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Parse references safely
  const references = useMemo(() => {
    try {
      if (!content) return [];

      const refs = parseReferences(content);
      return refs;
    } catch (error) {
      console.error("Error in ReferencesSection parsing:", error);
      setHasError(true);
      return [];
    }
  }, [content]);

  // Concatenate all references for copying
  const allReferencesText = useMemo(() => {
    try {
      return references.map((ref) => ref?.content || "").join("\n\n");
    } catch (error) {
      console.error("Error concatenating references:", error);
      return "";
    }
  }, [references]);

  // Copy all references to clipboard
  const copyAllReferences = async () => {
    try {
      await navigator.clipboard.writeText(allReferencesText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy references:", err);
    }
  };

  // Error state
  if (hasError) {
    return (
      <div className="mt-8 border rounded-xl border-red-200 dark:border-red-700 overflow-hidden">
        <div className="px-4 py-3 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300">
          Error processing references
        </div>
      </div>
    );
  }

  // No references to show
  if (!references || references.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 border rounded-xl border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
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
              <path d="M20 6L9 17l-5-5" />
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

      {/* References List */}
      <div>
        {references.map((ref, index) => (
          <ReferenceItem
            key={`ref-${
              ref?.number !== undefined ? ref.number : index
            }-${index}`}
            reference={ref}
            index={index}
          />
        ))}
      </div>
    </div>
  );
});

ReferencesSection.displayName = "ReferencesSection";

export default ReferencesSection;
