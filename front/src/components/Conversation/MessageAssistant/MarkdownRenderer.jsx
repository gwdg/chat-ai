import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Code2, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import DOMPurify from "dompurify";

import "katex/dist/katex.min.css";
import ThinkingBlock from "./ThinkingBlock";
import ReferencesSection from "./ReferencesSection";
import Code from "./Code";
import MermaidDiagram from "./MermaidDiagram";
import { selectHtmlRenderMode, selectHtmlLoadExternal } from "../../../Redux/reducers/userSettingsReducer";

/* --------------------------------------------
 * Shared renderer components (unchanged styles)
 * -------------------------------------------- */
export const rendererComponents = {
  code({ className, children, node }) {
    const match = /language-(\w+)/.exec(className || "");
    const content = String(children).replace(/\n$/, "");
    const isCodeBlock = node?.parent?.tagName === "pre";
    const hasNewlines = content.includes("\n");
    const isMultiLine =
      node?.position && node.position.start.line !== node.position.end.line;
    const isInline = !isCodeBlock && !hasNewlines && !isMultiLine;

    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-xs">
          {content}
        </code>
      );
    }

    if (match && match[1] === "mermaid") {
      return <MermaidDiagram content={content} />;
    }

    if (match && match[1] === "html") {
      return <HtmlBlock content={content} />;
    }

    return <Code language={match ? match[1] : null}>{content}</Code>;
  },

  pre({ children, ...props }) {
    return <pre {...props}>{children}</pre>;
  },

  p: ({ children }) => <div className="text-sm">{children}</div>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors text-sm"
    >
      {children}
    </a>
  ),
  h1: ({ children, id }) => (
    <h1
      className="text-xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h1>
  ),
  h2: ({ children, id }) => (
    <h2
      className="text-lg font-semibold mt-5 mb-3 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3
      className="text-base font-medium mt-4 mb-2 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4
      className="text-sm font-medium mt-3 mb-2 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h4>
  ),
  h5: ({ children, id }) => (
    <h5
      className="text-xs font-medium mt-2 mb-1 text-gray-900 dark:text-gray-100"
      id={id}
    >
      {children}
    </h5>
  ),
  h6: ({ children, id }) => (
    <h6
      className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1"
      id={id}
    >
      {children}
    </h6>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-gray-900 dark:text-gray-100 text-sm">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-800 dark:text-gray-200 text-sm">
      {children}
    </em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1 text-sm">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-800 dark:text-gray-200 text-sm">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-r text-sm">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="w-full overflow-x-auto my-4">
      <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="bg-white dark:bg-gray-900">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 text-sm">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-gray-800 dark:text-gray-200 text-sm">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="border-t border-gray-300 dark:border-gray-700 my-6" />
  ),
  math: ({ value }) => (
    <div className="my-4 text-center">
      <span className="katex-display">{value}</span>
    </div>
  ),
  inlineMath: ({ value }) => <span className="katex">{value}</span>,
};

/* ------------------------------------------------
 * LaTeX preprocessor
 * ------------------------------------------------ */
const preprocessLaTeX = (content) => {
  if (!content) return "";

  const codeBlocks = [];
  let processedContent = content.replace(
    /(```[\s\S]*?```|`[^`\n]+`)/g,
    (match, code) => {
      codeBlocks.push(code);
      return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
    }
  );

  // Inline $...$ follows pandoc's tex_math_dollars rule (as markdown-it-katex
  // does): the opening $ needs a non-space on its right, the next unescaped $
  // closes only with a non-space on its left and no digit on its right, and
  // the region may not cross a blank line. So "$3g=90$" is math, while
  // "$20,000 and $30,000" is not. Escape pairs like "\$" or "\\" are consumed
  // as a unit, so an escaped character never acts as a delimiter. Every other
  // single $ is escaped, so remark-math, which pairs dollars by different
  // rules, cannot turn it into a delimiter.
  const latexExpressions = [];
  processedContent = processedContent.replace(
    /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\)|\\[\s\S]|\$\$|\$(?=[^\s$])(?:\\[\s\S]|[^\\$\n]|\n(?![ \t]*\n))*(?:\\\S|[^\\$\s])\$(?!\d)|\$/g,
    (match) => {
      if (match === "$") return "\\$";
      if (match === "$$" || (match.length === 2 && match[0] === "\\")) {
        return match;
      }
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    }
  );

  processedContent = processedContent.replace(/<<LATEX_(\d+)>>/g, (_, i) => {
    // Convert \[...\] and \(...\) to the $$/$ delimiters remark-math expects
    // here, on the matched math only, so code blocks and math bodies (e.g.
    // the "\\[4pt]" row separator) are never rewritten.
    const latex = latexExpressions[parseInt(i)];
    if (latex.startsWith("\\[")) return `$$${latex.slice(2, -2)}$$`;
    if (latex.startsWith("\\(")) return `$${latex.slice(2, -2)}$`;
    return latex;
  });

  processedContent = processedContent.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, i) => {
      return codeBlocks[parseInt(i)];
    }
  );

  return processedContent;
};

/* ------------------------------------------------
 * HTML sanitizer
 *
 * Model output is untrusted: raw HTML reaches the DOM verbatim. rehype-raw only
 * turns raw HTML into live elements, so any raw <script>, event handler, or
 * <iframe> fetching a local-network URL would run. Sanitize every raw HTML
 * fragment with DOMPurify (allowlist-based) before rehype-raw parses it.
 * ------------------------------------------------ */
const SAFE_HTML_TAGS = [
  "a", "abbr", "b", "bdi", "bdo", "blockquote", "br", "caption", "cite",
  "code", "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl",
  "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "q",
  "s", "samp", "small", "span", "strong", "sub", "summary", "sup", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
];

const SAFE_HTML_ATTRS = [
  "href", "src", "alt", "title", "width", "height",
  "colspan", "rowspan", "scope", "start", "type", "value",
  "datetime", "cite", "open",
];

const sanitizeHtmlFragment = (html) =>
  DOMPurify.sanitize(html, {
    ALLOWED_TAGS: SAFE_HTML_TAGS,
    ALLOWED_ATTR: SAFE_HTML_ATTRS,
    ALLOW_DATA_ATTR: false,
  });

// Like sanitizeHtmlFragment but also permits embedded <svg> (including filters
// and gradients) so fenced HTML blocks can render SVG diagrams. It uses
// DOMPurify's battle-tested HTML + SVG profiles (correct geometry/presentation
// attributes) while explicitly forbidding the dangerous elements those profiles
// would otherwise allow — same hardening as sanitizeHtmlFragment.
//
// When loadExternal is false, src/href/xlink:href attributes that point to an
// external host are dropped for privacy, so the browser never contacts third
// parties. Same-page anchors, relative paths, data: URIs and mailto: are kept.
const isExternalUrl = (value) => {
  const v = (value || "").trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (
    lower.startsWith("#") ||
    lower.startsWith("data:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return false;
  }
  // Protocol-relative (//host) or any scheme (http:, https:, ...) → external
  if (/^\/\//.test(lower)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(lower)) return true;
  return false; // relative path or bare name
};

const blockExternalRefHook = (node, data) => {
  if (
    data.attrName === "src" ||
    data.attrName === "href" ||
    data.attrName === "xlink:href"
  ) {
    if (isExternalUrl(data.attrValue)) {
      data.keepAttr = false;
    }
  }
};

const sanitizeSvgHtml = (html, loadExternal = true) => {
  // addHook/removeHook are global on the DOMPurify instance; sanitize is
  // synchronous so add/remove around the single call is safe and reentrant.
  if (!loadExternal) {
    DOMPurify.addHook("uponSanitizeAttribute", blockExternalRefHook);
  }
  const result = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    FORBID_TAGS: [
      "iframe", "object", "embed", "form", "input", "textarea", "select",
      "button", "script", "style", "link", "meta", "base", "math",
      "foreignObject",
    ],
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  });
  if (!loadExternal) {
    DOMPurify.removeHook("uponSanitizeAttribute", blockExternalRefHook);
  }
  return result;
};

// remark plugin: scrub raw html nodes in the mdast tree so rehype-raw never
// turns dangerous markup into live elements. Runs before rehype-raw parses.
const remarkSanitizeHtml = () => (tree) => {
  const visit = (node) => {
    if (!Array.isArray(node.children)) return;
    node.children.forEach((child, i) => {
      if (child.type === "html") {
        node.children[i] = {
          ...child,
          value: sanitizeHtmlFragment(child.value),
        };
      } else {
        visit(child);
      }
    });
  };
  visit(tree);
};

// Renders a ```html fenced block. By default the fenced content is shown as
// live HTML (mirrors the mermaid fence); a button lets the user toggle between
// the rendered output and the raw code. The starting view honors the
// user_settings.html_render_mode preference ("render" | "code" | "off"), and
// "off" disables rendering entirely. The content is sanitized with the same
// DOMPurify allowlist as raw HTML before being inserted into the DOM.
const HtmlBlock = memo(({ content }) => {
  const { t } = useTranslation();
  const defaultMode = useSelector(selectHtmlRenderMode);
  const loadExternal = useSelector(selectHtmlLoadExternal);
  const [showCode, setShowCode] = useState(defaultMode === "code");

  useEffect(() => {
    setShowCode(defaultMode === "code");
  }, [defaultMode]);

  const safeHtml = useMemo(
    () => sanitizeSvgHtml(content || "", loadExternal),
    [content, loadExternal]
  );

  const codeContent = String(content || "").replace(/\n$/, "");

  if (defaultMode === "off") {
    return (
      <div className="relative my-2">
        <Code language="html">{codeContent}</Code>
      </div>
    );
  }

  return (
    <div className="relative my-2">
      <button
        type="button"
        onClick={() => setShowCode((prev) => !prev)}
        aria-pressed={!showCode}
        className="absolute -top-3 right-2 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {showCode ? (
          <>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {t("conversation.html_block.render")}
          </>
        ) : (
          <>
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("conversation.html_block.show_code")}
          </>
        )}
      </button>

      {showCode ? (
        <div className="pt-3">
          <Code language="html">{codeContent}</Code>
        </div>
      ) : (
        <div
          className="html-block pt-3"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      )}
    </div>
  );
});
HtmlBlock.displayName = "HtmlBlock";

/* ------------------------------------------------
 * Streaming processor (unchanged)
 * ------------------------------------------------ */
const useStreamingProcessor = (content, isLoading) => {
  const [displayedText, setDisplayedText] = useState("");
  const [referencesContent, setReferencesContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // NEW: live split outputs
  const [mainText, setMainText] = useState("");
  const [thinkBlocks, setThinkBlocks] = useState([]); // closed <think>...</think>
  const [liveThink, setLiveThink] = useState(""); // unclosed <think>... (streaming)

  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);
  const animationFrameRef = useRef(null);

  // helper to split think content from a buffer
  const splitThink = useCallback((buf) => {
    let temp = buf;
    const closed = [];

    // 1) remove CLOSED literal <think>...</think>
    temp = temp.replace(/<think\b[^>]*>([\s\S]*?)<\/think>/gi, (_, inner) => {
      closed.push(inner);
      return "";
    });

    // 2) remove CLOSED escaped &lt;think&gt;...&lt;/think&gt;
    temp = temp.replace(
      /&lt;think\b[^&]*&gt;([\s\S]*?)&lt;\/think&gt;/gi,
      (_, inner) => {
        closed.push(inner);
        return "";
      }
    );

    // 3) detect UN-CLOSED (literal or escaped)
    const lastOpenLit = temp.lastIndexOf("<think");
    const lastOpenEsc = temp.lastIndexOf("&lt;think");
    const lastCloseLit = temp.lastIndexOf("</think>");
    const lastCloseEsc = temp.lastIndexOf("&lt;/think&gt;");

    const lastOpen = Math.max(lastOpenLit, lastOpenEsc);
    const lastClose = Math.max(lastCloseLit, lastCloseEsc);

    let live = "";
    if (lastOpen !== -1 && lastOpen > lastClose) {
      // unclosed exists
      const escaped = lastOpen === lastOpenEsc;
      const tagEnd = escaped
        ? temp.indexOf("&gt;", lastOpen)
        : temp.indexOf(">", lastOpen);
      const afterOpen =
        tagEnd !== -1 ? tagEnd + (escaped ? "&gt;".length : 1) : lastOpen;
      live = temp.slice(afterOpen);
      temp = temp.slice(0, lastOpen); // cut from opening tag so nothing leaks outside
    }
    return { main: temp, closed, live };
  }, []);

  const processStreamingContent = useCallback(() => {
    if (!content || !isLoading) {
      // not streaming: finalize everything from full content
      setDisplayedText(content || "");
      setIsStreaming(false);

      // regular refs split (your existing logic)
      if (content) {
        const rrefMatch = content.match(/\[RREF\d+\]/i);
        if (rrefMatch) {
          const splitIndex = content.lastIndexOf("\n", rrefMatch.index);
          if (splitIndex !== -1) {
            setDisplayedText(content.substring(0, splitIndex).trim());
            setReferencesContent(content.substring(splitIndex).trim());
          }
        }
      }

      // build final think view from full content
      const { main, closed, live } = splitThink(content || "");
      setMainText(main);
      setThinkBlocks(closed);
      setLiveThink(live); // should be "" at end, but safe

      bufferRef.current = "";
      processedIndexRef.current = 0;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    setIsStreaming(true);

    const processNextChunk = () => {
      const chunkSize = 30;
      let i = 0;

      while (i < chunkSize && processedIndexRef.current < content.length) {
        const char = content[processedIndexRef.current];
        bufferRef.current += char;

        // Keep your displayedText/refs behavior
        const rrefMatch = bufferRef.current.match(/\[RREF\d+\]/i);
        if (rrefMatch) {
          const splitIndex = bufferRef.current.lastIndexOf(
            "\n",
            rrefMatch.index
          );
          if (splitIndex !== -1) {
            const mainContent = bufferRef.current
              .substring(0, splitIndex)
              .trim();
            const refContent = bufferRef.current.substring(splitIndex).trim();
            setDisplayedText(mainContent);
            setReferencesContent(refContent);
          } else {
            setDisplayedText(bufferRef.current);
          }
        } else {
          setDisplayedText(bufferRef.current);
        }

        // 🔥 NEW: split <think> live so nothing after <think> leaks outside
        const { main, closed, live } = splitThink(bufferRef.current);
        setMainText(main);
        setThinkBlocks(closed);
        setLiveThink(live);

        processedIndexRef.current++;
        i++;
      }

      if (processedIndexRef.current < content.length) {
        animationFrameRef.current = requestAnimationFrame(processNextChunk);
      }
    };

    if (processedIndexRef.current === 0) {
      setDisplayedText("");
      setReferencesContent("");
      bufferRef.current = "";
      setMainText("");
      setThinkBlocks([]);
      setLiveThink("");
    }

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [content, isLoading, splitThink]);

  useEffect(() => {
    processStreamingContent();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processStreamingContent]);

  // return BOTH the legacy fields and the new live-split fields
  return {
    displayedText,
    referencesContent,
    isStreaming,
    mainText, // <-- use this instead of running a separate extractor
    thinkBlocks, // closed <think> blocks (array)
    liveThink, // current unclosed <think> content (string)
  };
};

export const SafeMarkdown = ({
  children: markdownContent,
  components,
  enableKatex = true,
  renderHtml = false,
}) => {
  if (!markdownContent || typeof markdownContent !== "string") return null;

  try {
    // Raw HTML is only rendered when renderHtml is set, and even then every
    // html node is scrubbed by remarkSanitizeHtml (DOMPurify allowlist) before
    // rehype-raw turns it into live elements — never enable rehype-raw without
    // that sanitizer (see remarkHtmlAsText in ThinkingBlock.jsx).
    const remarkPlugins = [remarkGfm];
    if (enableKatex) remarkPlugins.push(remarkMath);
    if (renderHtml) remarkPlugins.push(remarkSanitizeHtml);

    const rehypePlugins = [];
    if (renderHtml) rehypePlugins.push(rehypeRaw);
    if (enableKatex)
      rehypePlugins.push([
        rehypeKatex,
        {
          output: "htmlAndMathml",
          throwOnError: false,
          trust: true,
          strict: false,
        },
      ]);

    return (
      <ReactMarkdown
        children={markdownContent}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components = {components || rendererComponents}
      />
    );
  } catch (err) {
    console.error("Error rendering markdown:", err);
    return (
      <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
        Error rendering content
      </div>
    );
  }
};

/* --------------------------------------------
 * Main MarkdownRenderer
 * -------------------------------------------- */
const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, renderMode = "Default" }) => {
    // KaTeX styling
    useEffect(() => {
      const style = document.createElement("style");
      style.textContent = `
      .katex-display {
        text-align: center !important;
        margin: 1em 0 !important;
      }
    `;
      document.head.appendChild(style);

      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }, []);

    const {
      displayedText,
      referencesContent,
      isStreaming,
      mainText,
      thinkBlocks,
      liveThink,
    } = useStreamingProcessor(children, isLoading);

    // helper to split think content from a buffer
    const splitThink = useCallback((buf) => {
      let temp = buf;
      const closed = [];

      // 1) remove CLOSED literal <think>...</think>
      temp = temp.replace(/<think\b[^>]*>([\s\S]*?)<\/think>/gi, (_, inner) => {
        closed.push(inner);
        return "";
      });

      // 2) remove CLOSED escaped &lt;think&gt;...&lt;/think&gt;
      temp = temp.replace(
        /&lt;think\b[^&]*&gt;([\s\S]*?)&lt;\/think&gt;/gi,
        (_, inner) => {
          closed.push(inner);
          return "";
        }
      );

      // 3) detect UN-CLOSED (literal or escaped)
      const lastOpenLit = temp.lastIndexOf("<think");
      const lastOpenEsc = temp.lastIndexOf("&lt;think");
      const lastCloseLit = temp.lastIndexOf("</think>");
      const lastCloseEsc = temp.lastIndexOf("&lt;/think&gt;");

      const lastOpen = Math.max(lastOpenLit, lastOpenEsc);
      const lastClose = Math.max(lastCloseLit, lastCloseEsc);

      let live = "";
      if (lastOpen !== -1 && lastOpen > lastClose) {
        // unclosed exists
        const escaped = lastOpen === lastOpenEsc;
        const tagEnd = escaped
          ? temp.indexOf("&gt;", lastOpen)
          : temp.indexOf(">", lastOpen);
        const afterOpen =
          tagEnd !== -1 ? tagEnd + (escaped ? "&gt;".length : 1) : lastOpen;
        live = temp.slice(afterOpen);
        temp = temp.slice(0, lastOpen); // cut from opening tag so nothing leaks outside
      }

      return { main: temp, closed, live };
    }, []);

    const separateContentAndReferences = useCallback((content) => {
      if (!content) return { main: "", refs: "" };
      const { main, closed, live } = splitThink(content || "");
      // Match: a line of 5+ dashes, then optional whitespace, then a line starting with "References:"
      // We capture from the dashes so the refs section starts with "References:" (cleaner for display).
      const re = /(^|\n)[-\s]{5,}\n\s*References\s*:\s*\n/i;
      const m = main.match(re);

      if (!m) {
        return { main, refs: "" };
      }

      // Split at the position where "References:" starts
      const splitIndex = m.index + (m[1] ? m[1].length : 0); // start of the dashes
      // Find the start of the "References:" line itself
      const afterDashes = main.slice(splitIndex);
      const refsHeaderIdx = afterDashes.search(/\n\s*References\s*:\s*\n/i);
      if (refsHeaderIdx === -1) return { main, refs: "" };

      const processedMain = main.slice(0, splitIndex).trim();
      const refs = afterDashes.slice(refsHeaderIdx + 1).trim(); // start from "References:" line

      return { main: processedMain, refs };
    }, []);

    const { main: processedMainContent, refs: processedReferences } =
      useMemo(() => {
        const contentToProcess = isLoading ? displayedText : children;
        return separateContentAndReferences(contentToProcess);
      }, [displayedText, children, isLoading, separateContentAndReferences]);

    const mainContent = useMemo(() => {
      return isLoading
        ? separateContentAndReferences(mainText).main // strip refs while streaming
        : processedMainContent; // already stripped when done
    }, [
      isLoading,
      mainText,
      processedMainContent,
      separateContentAndReferences,
    ]);
    const thinkingBlocks = useMemo(() => {
      return liveThink ? [...thinkBlocks, liveThink] : thinkBlocks;
    }, [thinkBlocks, liveThink]);

    const finalReferences = useMemo(() => {
      return isLoading ? referencesContent : processedReferences;
    }, [isLoading, referencesContent, processedReferences]);

    const renderContentByMode = useCallback((content) => {
      const contentToRender = content.trim();

      switch (renderMode) {
        case "Plaintext":
          return (
            <pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto">
              {contentToRender}
            </pre>
          );

        case "LaTeX":
          return (
            <SafeMarkdown
              enableKatex={true}
              components={{
                // Remove markdown rendering for components
                h1: ({ children }) => <>{children}</>,
                h2: ({ children }) => <>{children}</>,
                h3: ({ children }) => <>{children}</>,
                p: ({ children }) => <>{children}</>,
                strong: ({ children }) => <>{children}</>,
                em: ({ children }) => <>{children}</>,
                a: ({ children }) => <>{children}</>, // remove links
                math: ({ value }) => (
                  <div className="my-4 text-center p-4 bg-green-50 dark:bg-green-900/20 rounded border-2 border-green-200 dark:border-green-700">
                    <span className="katex-display">{value}</span>
                  </div>
                ),
                inlineMath: ({ value }) => (
                  <span className="katex bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded border border-green-300 dark:border-green-600">
                    {value}
                  </span>
                ),
              }}
            >
              {preprocessLaTeX(contentToRender)}
            </SafeMarkdown>
          );

        case "Markdown":
          // Pure markdown: no KaTeX transforms, no raw HTML path
          return (
            <SafeMarkdown
              enableKatex={false}
              components={rendererComponents}
            >
              {contentToRender}
            </SafeMarkdown>
          );

        default:
          // Default = Markdown + KaTeX, raw HTML rendered but sanitized
          return (
            <SafeMarkdown
              enableKatex={true}
              renderHtml={true}
              components={rendererComponents}
            >
              {preprocessLaTeX(contentToRender)}
            </SafeMarkdown>
          );
      }
    }, [renderMode]);

    if (!children) return null;

    return (
      <>
        <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
          {thinkingBlocks.map((content, index) => (
            <ThinkingBlock
              key={`thinking-${index}`}
              autoExpand={
                (isLoading || isStreaming) &&
                index === thinkingBlocks.length - 1
              }
              isStreaming={isStreaming && index === thinkingBlocks.length - 1}
              // Default keeps the block's own rendering, other modes follow the switch
              renderContent={
                renderMode === "Default" ? undefined : renderContentByMode
              }
            >
              {content}
            </ThinkingBlock>
          ))}

          {renderContentByMode(mainContent)}
        </div>

        {finalReferences && (
          <ReferencesSection
            content={finalReferences}
            isLoading={isLoading}
            isStreaming={isStreaming}
          />
        )}
      </>
    );
  }
);

MarkdownRenderer.displayName = "MarkdownRenderer";
export default MarkdownRenderer;
