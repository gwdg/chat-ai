import { useState, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ChevronDown, ChevronRight } from "lucide-react";

// Import shared markdown components
import { rendererComponents } from "./rendererComponents";

// Import utility from separate file
import { parseReferences } from "./parseReferences";

// ReferenceItem component
const ReferenceItem = memo(({ reference }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Extract title and content - memoize to avoid recalculation on re-renders
  const { titleText, contentWithoutTitle } = useMemo(() => {
    const firstLine = reference.content.split("\n")[0];
    return {
      titleText: firstLine.replace(/\[RREF\d+\]\s*/, "").trim(),
      contentWithoutTitle: reference.content
        .split("\n")
        .slice(1)
        .join("\n")
        .trim(),
    };
  }, [reference.content]);

  // Create custom link renderer to ensure links are clickable
  const linkRenderer = useMemo(
    () => ({
      ...rendererComponents,
      a: ({ ...props }) => (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          onClick={(e) => e.stopPropagation()} // Prevent button click when clicking on links
        >
          {props.children}
        </a>
      ),
    }),
    []
  );

  return (
    <div className="border-l-4 border-l-blue-500/50 hover:border-l-blue-500 transition-colors">
      <div
        className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between group cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`reference-${reference.number}`}
      >
        <div className="flex items-center gap-2 flex-grow overflow-hidden">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 whitespace-nowrap">
            RREF {reference.number + 1}
          </span>
          <div className="text-sm font-bold truncate text-gray-700 dark:text-gray-300">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={linkRenderer}
              className="inline"
            >
              {titleText}
            </ReactMarkdown>
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>
      {isOpen && (
        <div
          id={`reference-${reference.number}`}
          className="px-4 py-3 bg-gray-50 dark:bg-gray-800/30"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={linkRenderer}
          >
            {contentWithoutTitle}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
});

ReferenceItem.displayName = "ReferenceItem";

// ReferencesSection component
const ReferencesSection = memo(({ content }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  // Memoize references parsing to avoid recalculation on re-renders
  const references = useMemo(() => parseReferences(content), [content]);

  // Memoize the concatenated references text
  const allReferencesText = useMemo(
    () => references.map((ref) => ref.content).join("\n\n"),
    [references]
  );

  // Early return if no references
  if (references.length === 0) return null;

  const copyAllReferences = async () => {
    try {
      await navigator.clipboard.writeText(allReferencesText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy references:", err);
    }
  };

  return (
    <div className="mt-8 border rounded-xl border-gray-200 dark:border-gray-700 overflow-hidden">
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
      <div>
        {references.map((ref) => (
          <ReferenceItem key={ref.number} reference={ref} />
        ))}
      </div>
    </div>
  );
});

ReferencesSection.displayName = "ReferencesSection";

export default ReferencesSection;
