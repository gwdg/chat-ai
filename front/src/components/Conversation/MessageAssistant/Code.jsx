import { memo, useCallback, useState, useMemo, useRef, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import CodeCopyBtn from "../../Others/CodeCopyBtn";

const highlightCache = new Map();
const CACHE_LIMIT = 200;

// Walk up the DOM to find the nearest scrollable ancestor
function findScrollContainer(el) {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

const Code = memo(({ language, children }) => {
  const [hovered, setHovered] = useState(false);
  const [btnOffset, setBtnOffset] = useState(0);
  const codeRef = useRef(null);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const codeString = String(children).replace(/\n$/, "");

  const cacheKey = `${language || "text"}-${codeString}`;

  const highlighted = useMemo(() => {
    if (!codeString.trim()) return null;
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
      const firstKey = highlightCache.keys().next().value;
      highlightCache.delete(firstKey);
    }
    return result;
  }, [codeString, language, cacheKey]);

  // Dynamically offset the copy button so it stays visible while scrolling
  useEffect(() => {
    const el = codeRef.current;
    if (!el) return;

    const scrollContainer = findScrollContainer(el);
    if (!scrollContainer) return;

    let rafId = null;

    const update = () => {
      rafId = null;
      const codeRect = el.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // How far the code block's top is above the scroll viewport
      const above = containerRect.top - codeRect.top;

      if (above > 0) {
        // Button height ~24px + 8px padding = 32px safe zone from bottom
        const maxOffset = el.offsetHeight - 32;
        setBtnOffset(Math.min(above, maxOffset));
      } else {
        setBtnOffset(0);
      }
    };

    const onScroll = () => {
      if (rafId == null) rafId = requestAnimationFrame(update);
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  if (!highlighted) return null;

  return (
    <div
      ref={codeRef}
      className="relative block bg-neutral-800 rounded-lg p-1 my-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {highlighted}
      <div
        className="absolute top-2 right-2 z-10"
        style={{ transform: `translateY(${btnOffset}px)` }}
      >
        <CodeCopyBtn hovered={hovered}>{children}</CodeCopyBtn>
      </div>
    </div>
  );
});

Code.displayName = "Code";

export default Code;
