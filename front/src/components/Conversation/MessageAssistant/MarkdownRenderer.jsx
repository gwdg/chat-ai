import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { Code2, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router";
import {
  Folder,
  GraduationCap,
  MessageCircle,
  MessageSquare,
  PlayCircle,
  Settings,
} from "lucide-react";
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
import {
  selectHtmlRenderMode,
  selectHtmlLoadExternal,
  selectHtmlSanitization,
} from "../../../Redux/reducers/userSettingsReducer";
import LatexBlock from "./LatexBlock";
import PersonaStartLink from "../../Others/PersonaStartLink";
import TypstBlock from "./TypstBlock";
import {
  isExternalUrl,
  sanitizeExternalRefs,
} from "../../../utils/externalRefs";
import { stripPersonaMarkers } from "../../../utils/personaCatalog";
import { stripMetaActionMarkers } from "../../../utils/metaActions";

// Markdown images load automatically, so keep them on the same origin when
// external references are disabled. Plain links are not fetched until clicked.
const MarkdownImage = ({ src, alt, ...props }) => {
  const loadExternal = useSelector(selectHtmlLoadExternal);
  // react-markdown passes its AST node as a prop; never forward it to the DOM.
  delete props.node;
  if (!loadExternal && isExternalUrl(src)) {
    return <span className="text-base-content/70">{alt || ""}</span>;
  }
  return <img src={src} alt={alt} {...props} />;
};

// Conversation links produced by the Meta chat navigate inside the SPA.
const MarkdownLink = ({ href, children }) => {
  const navigate = useNavigate();
  const className =
    "text-info hover:text-info underline transition-colors text-sm";
  const actionLinkClassName =
    "btn btn-accent btn-xs ml-1 inline-flex w-fit gap-1 align-middle";

  if (
    typeof href === "string" &&
    (href.startsWith("/chat/") || href.startsWith("/topic/"))
  ) {
    const isMessage = href.includes("?message=");
    const isTopic = href.startsWith("/topic/");
    const Icon = isTopic ? Folder : isMessage ? MessageSquare : MessageCircle;
    return (
      <a
        href={href}
        data-guide={isMessage ? "message-citation" : undefined}
        className={actionLinkClassName}
        onClick={(event) => {
          event.preventDefault();
          navigate(href);
        }}
      >
        <Icon size={12} aria-hidden="true" />
        {children}
      </a>
    );
  }

  const settingsMatch =
    typeof href === "string" &&
    href.match(/^\/settings\/(profile|chat|memories|data)$/);
  if (settingsMatch) {
    return (
      <a
        href={href}
        className={actionLinkClassName}
        onClick={(event) => {
          event.preventDefault();
          window.dispatchEvent(
            new CustomEvent("chatai:open-settings", {
              detail: { tab: settingsMatch[1] },
            }),
          );
        }}
      >
        <Settings size={12} aria-hidden="true" />
        {children}
      </a>
    );
  }

  const tutorialMatch =
    typeof href === "string" && href.match(/^\/tutorial\/([a-zA-Z0-9_-]+)$/);
  if (tutorialMatch) {
    return (
      <a
        href={href}
        className={actionLinkClassName}
        onClick={(event) => {
          event.preventDefault();
          window.dispatchEvent(
            new CustomEvent("chatai:start-feature-guide", {
              detail: { featureId: tutorialMatch[1] },
            }),
          );
        }}
      >
        <GraduationCap size={12} aria-hidden="true" />
        {children}
      </a>
    );
  }

  const useCaseMatch =
    typeof href === "string" &&
    href.match(/^\/use-?case\/([a-zA-Z0-9_-]+)$/i);
  if (useCaseMatch) {
    return (
      <a
        href={href}
        className={actionLinkClassName}
        onClick={(event) => {
          event.preventDefault();
          window.dispatchEvent(
            new CustomEvent("chatai:start-use-case", {
              detail: { useCaseId: useCaseMatch[1] },
            }),
          );
        }}
      >
        <PlayCircle size={12} aria-hidden="true" />
        {children}
      </a>
    );
  }

  const personaMatch =
    typeof href === "string" && href.match(/^\/persona\/(.+\.json)$/i);
  if (personaMatch) {
    let path = personaMatch[1];
    try {
      path = decodeURIComponent(path);
    } catch {
      // Keep the original path if it is not valid percent-encoding.
    }
    return <PersonaStartLink path={path}>{children}</PersonaStartLink>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
};

/* --------------------------------------------
 * Shared renderer components (unchanged styles)
 * -------------------------------------------- */
export const rendererComponents = {
  img: MarkdownImage,
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
        <code className="px-1.5 py-0.5 rounded bg-base-200 text-primary font-mono text-xs">
          {content}
        </code>
      );
    }

    const language = match ? match[1].toLowerCase() : null;

    if (language === "mermaid") {
      return <MermaidDiagram content={content} />;
    }

    if (language === "html") {
      return <HtmlBlock content={content} />;
    }

    if (language === "latex" || language === "tex") {
      return <LatexBlock content={content} language={language} />;
    }

    if (language === "typst" || language === "typ") {
      return <TypstBlock content={content} language={language} />;
    }

    return (
      <TypstBlock
        content={content}
        language={match ? match[1] : null}
        defaultRender={false}
      />
    );
  },

  pre({ children, ...props }) {
    return <pre {...props}>{children}</pre>;
  },

  p: ({ children }) => <div className="text-sm">{children}</div>,
  a: MarkdownLink,
  h1: ({ children, id }) => (
    <h1
      className="text-xl font-bold mt-6 mb-4 text-base-content"
      id={id}
    >
      {children}
    </h1>
  ),
  h2: ({ children, id }) => (
    <h2
      className="text-lg font-semibold mt-5 mb-3 text-base-content"
      id={id}
    >
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3
      className="text-base font-medium mt-4 mb-2 text-base-content"
      id={id}
    >
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4
      className="text-sm font-medium mt-3 mb-2 text-base-content"
      id={id}
    >
      {children}
    </h4>
  ),
  h5: ({ children, id }) => (
    <h5
      className="text-xs font-medium mt-2 mb-1 text-base-content"
      id={id}
    >
      {children}
    </h5>
  ),
  h6: ({ children, id }) => (
    <h6
      className="text-xs font-medium text-base-content/70 mt-2 mb-1"
      id={id}
    >
      {children}
    </h6>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-base-content text-sm">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-base-content text-sm">
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
    <li className="text-base-content text-sm">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-info pl-4 py-2 my-4 italic text-base-content bg-base-200/50 rounded-r text-sm">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="w-full overflow-x-auto my-4">
      <table className="w-full border-collapse border border-base-300 rounded-lg overflow-hidden text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-base-200">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="bg-base-100">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-base-300 hover:bg-base-200/50 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="border border-base-300 px-4 py-3 text-left font-semibold text-base-content bg-base-200 text-sm">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-base-300 px-4 py-2 text-base-content text-sm">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="border-t border-base-300 my-6" />
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

// Extra tags/attributes permitted only when the user opts into relaxed
// sanitization so interactive HTML (buttons, forms, iframes, scripts, inline
// styles) can run. Untrusted model output can execute code with this setting.
const RELAXED_HTML_TAGS = [
  "button", "form", "iframe", "input", "label", "legend", "option", "select",
  "style", "textarea", "script", "canvas", "audio", "video", "source",
  "progress", "meter", "output", "fieldset", "datalist", "optgroup",
];
const RELAXED_HTML_ATTRS = [
  "style", "class", "id", "name", "for", "action", "method", "target",
  "placeholder", "checked", "selected", "disabled", "readonly", "required",
  "rows", "cols", "maxlength", "min", "max", "step", "pattern", "autocomplete",
  "contenteditable", "tabindex", "role", "aria-label", "controls", "autoplay",
  "loop", "muted", "poster", "frameborder", "allow", "allowfullscreen",
  "sandbox", "download", "rel", "data", "onclick", "onchange", "oninput",
  "onkeydown", "onkeyup", "onkeypress", "onmouseover", "onmouseout",
  "onmousedown", "onmouseup", "onfocus", "onblur", "onsubmit", "onload",
  "onerror",
];

// Like sanitizeHtmlFragment but also permits embedded <svg> (including filters
// and gradients) so fenced HTML blocks can render SVG diagrams. It uses
// DOMPurify's battle-tested HTML + SVG profiles (correct geometry/presentation
// attributes) while explicitly forbidding the dangerous elements those profiles
// would otherwise allow — same hardening as sanitizeHtmlFragment.
//
// When loadExternal is false, URL-bearing attributes that point to an external
// host are dropped for privacy, so the browser never contacts third parties.
// This covers src, href, xlink:href, poster, action, formaction, data, srcset
// and CSS url() inside style. Same-page anchors, relative paths, data: URIs
// and mailto: are kept (see utils/externalRefs.js).
const sanitizeHtmlFragment = (html, relaxed = false, loadExternal = true) =>
  sanitizeExternalRefs(loadExternal, () =>
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: relaxed ? [...SAFE_HTML_TAGS, ...RELAXED_HTML_TAGS] : SAFE_HTML_TAGS,
      ALLOWED_ATTR: relaxed ? [...SAFE_HTML_ATTRS, ...RELAXED_HTML_ATTRS] : SAFE_HTML_ATTRS,
      ALLOW_DATA_ATTR: relaxed,
    })
  );

const sanitizeSvgHtml = (html, loadExternal = true, relaxed = false) =>
  sanitizeExternalRefs(loadExternal, () =>
    DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    // Relaxed mode allows scripts, and the SAFE_FOR_XML mXSS heuristic
    // force-removes any script/style whose text contains markup-like text
    // (e.g. `</b>` inside a JS template literal), which is normal in
    // interactive documents. The output only ever runs in the sandboxed
    // iframe, so skip that heuristic once the user has opted into scripts.
    SAFE_FOR_XML: !relaxed,
    FORBID_TAGS: relaxed
      ? []
      : [
          "iframe", "object", "embed", "form", "input", "textarea", "select",
          "button", "script", "style", "link", "meta", "base", "math",
          "foreignObject",
        ],
    FORBID_ATTR: relaxed ? [] : ["style"],
    ALLOW_DATA_ATTR: relaxed,
    ADD_TAGS: relaxed ? RELAXED_HTML_TAGS : [],
    ADD_ATTR: relaxed ? RELAXED_HTML_ATTRS : [],
    ALLOW_UNKNOWN_PROTOCOLS: relaxed,
    })
  );

// remark plugin: scrub raw html nodes in the mdast tree so rehype-raw never
// turns dangerous markup into live elements. Runs before rehype-raw parses.
const remarkSanitizeHtml = ({ loadExternal = true } = {}) => (tree) => {
  const visit = (node) => {
    if (!node || !Array.isArray(node.children)) return;
    node.children.forEach((child, i) => {
      if (child.type === "html") {
        node.children[i] = {
          ...child,
          value: sanitizeHtmlFragment(child.value, false, loadExternal),
        };
      } else {
        visit(child);
      }
    });
  };
  visit(tree);
};

// DOMPurify discards <head> content entirely (it only returns body content).
// Well-formed pages put their CSS/JS in <head>, so without this the whole
// stylesheet would be lost. Move <style>, <script> and stylesheet <link>
// elements out of <head> and into <body> so they survive sanitization.
const relocateHeadAssets = (html) => {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return html;
  const assets = [];
  headMatch[1].replace(
    /<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>|<link\b[^>]*rel=["']stylesheet["'][^>]*\/?>/gi,
    (m) => {
      assets.push(m);
      return "";
    }
  );
  if (!assets.length) return html;
  let result = html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "");
  const closeIdx = result.search(/<\/body>/i);
  const insert = assets.join("\n");
  if (closeIdx !== -1) {
    result = result.slice(0, closeIdx) + insert + "\n" + result.slice(closeIdx);
  } else {
    result = result + insert;
  }
  return result;
};

// Renders a ```html fenced block. By default the fenced content is shown as
// live HTML (mirrors the mermaid fence); a button lets the user toggle between
// the rendered output and the raw code. The starting view honors the
// user_settings.html_render_mode preference ("render" | "code" | "off"), and
// "off" disables rendering entirely. The content is sanitized with the same
// DOMPurify allowlist as raw HTML before being inserted into the DOM.
// Tiny script appended to the iframe document so it can report its content
// height back to the parent for auto-resizing. Runs inside the sandboxed,
// opaque-origin iframe.
const RESIZE_PROBE =
  "<script>" +
  "(function(){function report(){" +
  "var b=document.body;var d=document.documentElement;" +
  "var h=Math.max(b.scrollHeight,d.scrollHeight);" +
  "window.parent.postMessage({__htmlBlockResize:h},'*');" +
  "}window.addEventListener('load',report);setTimeout(report,50);})()" +
  "</script>";

const HtmlBlock = memo(({ content, isLoading }) => {
  const { t } = useTranslation();
  const defaultMode = useSelector(selectHtmlRenderMode);
  const loadExternal = useSelector(selectHtmlLoadExternal);
  const sanitization = useSelector(selectHtmlSanitization);
  const relaxed = sanitization === "relaxed";
  const sanitizationLabel = t(
    `user_settings.chat_preferences.html_render.sanitization.options.${sanitization}.label`
  );
  const [showCode, setShowCode] = useState(defaultMode !== "render");
  const [iframeHeight, setIframeHeight] = useState(500);

  useEffect(() => {
    setShowCode(defaultMode !== "render");
  }, [defaultMode]);

  const safeHtml = useMemo(() => {
    const relocated = relocateHeadAssets(content || "");
    return sanitizeSvgHtml(relocated, loadExternal, relaxed);
  }, [content, loadExternal, relaxed]);

  // srcdoc gives the block a real document context (its own <body>, 100vh,
  // background and scroll) so full standalone pages render and layout
  // correctly. The iframe is sandboxed with an opaque origin (no
  // allow-same-origin), so embedded scripts cannot touch the parent page —
  // safer than injecting into the main document. A probe script posts the
  // content height back so the iframe can auto-resize.
  const srcDoc = useMemo(
    () => (relaxed ? `${safeHtml}\n${RESIZE_PROBE}` : safeHtml),
    [safeHtml, relaxed]
  );

  // Listen for the height message from the sandboxed iframe.
  useEffect(() => {
    const onMessage = (event) => {
      const data = event.data;
      if (data && typeof data === "object" && data.__htmlBlockResize) {
        setIframeHeight(Number(data.__htmlBlockResize) || 500);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const codeContent = String(content || "").replace(/\n$/, "");

  // While the message is still streaming the fenced block may be incomplete.
  // Do not render partial HTML: show the raw code until the whole block has
  // been received.
  const forceCode = isLoading;
  const codeVisible = showCode || forceCode;

  return (
    <div className="relative my-2">
      <button
        type="button"
        onClick={() => setShowCode((prev) => !prev)}
        disabled={forceCode}
        aria-pressed={!codeVisible}
        className="absolute -top-3 right-2 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-base-300 bg-base-100 px-2 py-1 text-[11px] font-medium text-base-content/70 shadow-sm transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {codeVisible ? (
          <>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {t("conversation.html_block.render")} ({sanitizationLabel})
          </>
        ) : (
          <>
            <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("conversation.html_block.show_code")}
          </>
        )}
      </button>

      {codeVisible ? (
        <div className="pt-3">
          <Code language="html">{codeContent}</Code>
        </div>
      ) : (
        <iframe
          title={t("conversation.html_block.render")}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className="html-block w-full overflow-hidden rounded border border-base-300 bg-base-100"
          style={{ height: iframeHeight, minHeight: 200 }}
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
  loadExternal = true,
}) => {
  if (!markdownContent || typeof markdownContent !== "string") return null;

  try {
    // Raw HTML is only rendered when renderHtml is set, and even then every
    // html node is scrubbed by remarkSanitizeHtml (DOMPurify allowlist) before
    // rehype-raw turns it into live elements — never enable rehype-raw without
    // that sanitizer (see remarkHtmlAsText in ThinkingBlock.jsx).
    const remarkPlugins = [remarkGfm];
    if (enableKatex) remarkPlugins.push(remarkMath);
    if (renderHtml)
      remarkPlugins.push([remarkSanitizeHtml, { loadExternal }]);

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
      <div className="text-error bg-error/10 p-2 rounded">
        Error rendering content
      </div>
    );
  }
};

const stripGuideMarkers = (content) => {
  if (typeof content !== "string") return content;
  return stripMetaActionMarkers(stripPersonaMarkers(content))
    .replace(/\[\[GUIDE:[a-zA-Z0-9_-]+\]\]/gi, "")
    .replace(/\[\[USE_CASE:[a-zA-Z0-9_-]+\]\]/gi, "")
    .replace(/\[\[(?:GUIDE|USE_CASE|PERSONA):?[a-zA-Z0-9_./-]*\]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
};

/* --------------------------------------------
 * Main MarkdownRenderer
 * -------------------------------------------- */
const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, renderMode = "Default" }) => {
    const loadExternal = useSelector(selectHtmlLoadExternal);
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
        return separateContentAndReferences(stripGuideMarkers(contentToProcess));
      }, [displayedText, children, isLoading, separateContentAndReferences]);

    const mainContent = useMemo(() => {
      return isLoading
        ? separateContentAndReferences(stripGuideMarkers(mainText)).main // strip refs while streaming
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

      // rendererComponents but with the html fence wired to receive isLoading
      // so HtmlBlock can avoid rendering partial HTML while streaming.
      const components = {
        ...rendererComponents,
        code(props) {
          const match = /language-(\w+)/.exec(props.className || "");
          if (match && match[1] === "html") {
            return (
              <HtmlBlock
                content={String(props.children).replace(/\n$/, "")}
                isLoading={isLoading}
              />
            );
          }
          return rendererComponents.code(props);
        },
      };

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
                img: MarkdownImage,
                math: ({ value }) => (
                  <div className="my-4 text-center p-4 bg-success/10 rounded border-2 border-success/30">
                    <span className="katex-display">{value}</span>
                  </div>
                ),
                inlineMath: ({ value }) => (
                  <span className="katex bg-success/15 px-1 py-0.5 rounded border border-success/40">
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
              components={components}
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
              loadExternal={loadExternal}
              components={components}
            >
              {preprocessLaTeX(contentToRender)}
            </SafeMarkdown>
          );
      }
    }, [renderMode, isLoading, loadExternal]);

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
