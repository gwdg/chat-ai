import { memo, useCallback, useState, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeCopyBtn from "../../Others/CodeCopyBtn";

const highlightCache = new Map();
const CACHE_LIMIT = 200;

const Code = memo(({ language, children }) => {
  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const codeString = String(children).replace(/\n$/, "");
  if (!codeString.trim()) return null;

  const cacheKey = `${language || "text"}-${codeString}`;

  const highlighted = useMemo(() => {
    if (highlightCache.has(cacheKey)) {
      return highlightCache.get(cacheKey);
    }
    const result = (
      <SyntaxHighlighter
        style={vscDarkPlus}
        className="custom-syntax-highlighter !bg-transparent"
        language={language || "text"}
        PreTag="div"
        wrapLines={true}
        wrapLongLines={true}
        customStyle={{
          fontSize: "1.05rem",
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    );
    highlightCache.set(cacheKey, result);
    if (highlightCache.size > CACHE_LIMIT) {
      // delete first-in (Map preserves insertion order)
      const firstKey = highlightCache.keys().next().value;
      highlightCache.delete(firstKey);
    }
    return result;
  }, [codeString, language, cacheKey]);

  return (
    <div
      className="relative block bg-neutral-800 rounded-lg p-1 my-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {highlighted}
      <CodeCopyBtn hovered={hovered}>{children}</CodeCopyBtn>
    </div>
  );
});

Code.displayName = "Code";

export default Code;
