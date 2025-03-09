import { memo, useCallback, useState, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeCopyBtn from "../Others/CodeCopyBtn";

// Global cache for highlighted code to improve performance
const highlightCache = new Map();

// Size-limited cache to prevent memory issues
const MAX_CACHE_SIZE = 100;

/**
 * Custom style based on vscDarkPlus but with larger font
 */
const customStyle = {
  ...vscDarkPlus,
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    fontSize: "1rem", // Increased from default (usually 0.875rem)
    lineHeight: "1.5",
  },
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    fontSize: "1rem", // Increased from default
    lineHeight: "1.5",
  },
};

/**
 * Code component for syntax highlighting of code blocks
 * @param {Object} props - Component props
 * @param {string} props.language - Programming language for syntax highlighting
 * @param {string} props.children - Code content to display
 */
const Code = memo(({ language, children }) => {
  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  // Clean and normalize the code string
  const codeString = useMemo(() => {
    // Handle null or undefined children
    if (!children) return "";
    return String(children).replace(/\n$/, "");
  }, [children]);

  // Create a cache key based on language and content
  const cacheKey = useMemo(
    () => `${language || "text"}-${codeString.substring(0, 100)}`,
    [language, codeString]
  );

  // Determine language for syntax highlighting
  const codeLanguage = useMemo(() => {
    // Map common language aliases to their proper names
    const languageMap = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      rb: "ruby",
      sh: "bash",
      yml: "yaml",
      md: "markdown",
    };

    return languageMap[language?.toLowerCase()] || language || "text";
  }, [language]);

  // Generate or retrieve cached highlighted code
  const highlighted = useMemo(() => {
    // Check cache first
    if (highlightCache.has(cacheKey)) {
      return highlightCache.get(cacheKey);
    }

    // Generate new highlighted component
    const result = (
      <SyntaxHighlighter
        style={customStyle}
        className="custom-syntax-highlighter !bg-transparent text-base"
        language={codeLanguage}
        PreTag="div"
        wrapLines={true}
        wrapLongLines={true}
      >
        {codeString}
      </SyntaxHighlighter>
    );

    // Manage cache size
    if (highlightCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry (first key in the map)
      const firstKey = highlightCache.keys().next().value;
      highlightCache.delete(firstKey);
    }

    // Add to cache
    highlightCache.set(cacheKey, result);
    return result;
  }, [codeString, codeLanguage, cacheKey]);

  return (
    <div
      className="relative block bg-neutral-800 rounded-lg p-1 my-4 text-base"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-language={codeLanguage}
      role="region"
      aria-label={`Code snippet in ${codeLanguage}`}
    >
      {highlighted}
      <CodeCopyBtn hovered={hovered}>{codeString}</CodeCopyBtn>
    </div>
  );
});

Code.displayName = "Code";

export default Code;
