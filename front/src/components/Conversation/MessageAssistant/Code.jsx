import { memo, useCallback, useState, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeCopyBtn from "../../Others/CodeCopyBtn";

const highlightCache = new Map();

const Code = memo(({ language, children }) => {
  const [hovered, setHovered] = useState(false);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const codeString = String(children).replace(/\n$/, "");
  const cacheKey = `${language}-${codeString}`;

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
