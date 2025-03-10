/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import mermaid from "mermaid";
import Code from "./Code";
import ThinkingBlock from "./ThinkingBlock";
import ReferencesSection from "./ReferencesSection";

// Initialize mermaid
mermaid.initialize({ startOnLoad: false, theme: "forest" });

// MermaidDiagram component
const MermaidDiagram = memo(({ content }) => {
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 10)}`;
        if (await mermaid.parse(content, { suppressErrors: true })) {
          const { svg } = await mermaid.render(id, content);
          setSvg(svg);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(true);
      }
    };

    renderDiagram();
  }, [content]);

  if (error) {
    return <div className="p-2 text-red-500">Failed to render diagram</div>;
  }

  if (!svg) {
    return <div className="p-2">Loading diagram...</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
});

MermaidDiagram.displayName = "MermaidDiagram";

// Markdown component renderers
export const rendererComponents = {
  code: ({ inline, className, children }) => {
    const match = /language-(\w+)/.exec(className || "");
    const content = String(children).replace(/\n$/, "");

    if (inline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 font-mono text-sm">
          {content}
        </code>
      );
    }

    if (match && match[1] === "mermaid") {
      return <MermaidDiagram content={content} />;
    }

    return <Code language={match?.[1]}>{content}</Code>;
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-500 underline"
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="mb-3">{children}</p>,
  h1: ({ children, id }) => (
    <h1 className="text-2xl font-bold mt-4" id={id}>
      {children}
    </h1>
  ),
  h2: ({ children, id }) => (
    <h2 className="text-xl font-semibold mt-3" id={id}>
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3 className="text-lg font-medium mt-2" id={id}>
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4 className="text-md font-medium mt-1" id={id}>
      {children}
    </h4>
  ),
  h5: ({ children, id }) => (
    <h5 className="text-sm font-medium" id={id}>
      {children}
    </h5>
  ),
  h6: ({ children, id }) => (
    <h6 className="text-xs font-medium text-gray-600" id={id}>
      {children}
    </h6>
  ),
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 pl-4 italic text-gray-600">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="w-full overflow-x-auto my-4">
      <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
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
    <tr className="border-b border-gray-300 dark:border-gray-700">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
      {children}
    </td>
  ),
};

// Optimized streaming text processor
const useStreamingProcessor = (content, isLoading) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);
  const animationFrameRef = useRef(null);

  const processStreamingContent = useCallback(() => {
    if (!content || !isLoading) {
      setDisplayedText(content || "");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
      processedIndexRef.current = 0;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      return;
    }

    const processNextChunk = () => {
      const chunkSize = 50;
      let i = 0;

      while (i < chunkSize && processedIndexRef.current < content.length) {
        const char = content[processedIndexRef.current];
        bufferRef.current += char;

        // Process thinking blocks
        if (bufferRef.current.includes("<think>")) {
          const [beforeThink] = bufferRef.current.split("<think>");
          setDisplayedText(beforeThink);
          setIsThinking(true);
          bufferRef.current = "";
        } else if (bufferRef.current.includes("</think>")) {
          const [thinkContent] = bufferRef.current.split("</think>");
          setThinkingContent(thinkContent);
          setIsThinking(false);
          bufferRef.current = "";
        } else if (!isThinking) {
          setDisplayedText((prev) => prev + char);
        } else {
          setThinkingContent((prev) => prev + char);
        }

        processedIndexRef.current++;
        i++;
      }

      if (processedIndexRef.current < content.length) {
        animationFrameRef.current = requestAnimationFrame(processNextChunk);
      }
    };

    // Reset state when starting to stream
    if (processedIndexRef.current === 0) {
      setDisplayedText("");
      setThinkingContent("");
      setIsThinking(false);
      bufferRef.current = "";
    }

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [content, isLoading]);

  // Set up streaming effect
  useEffect(() => {
    processStreamingContent();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processStreamingContent]);

  return { displayedText, isThinking, thinkingContent };
};

// Main Markdown Renderer component
const MarkdownRenderer = memo(({ children, isDarkMode, isLoading }) => {
  // Use optimized streaming processor
  const { displayedText, isThinking, thinkingContent } = useStreamingProcessor(
    children,
    isLoading
  );

  // Nothing to display
  if (!children) return null;

  // Split content for references section
  const hasReferences = children.includes("References:");
  const [mainContent, referencesContent] = hasReferences
    ? children.split("References:")
    : [children, null];

  return (
    <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
      {isLoading ? (
        <>
          {thinkingContent && (
            <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
          )}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={rendererComponents}
          >
            {displayedText}
          </ReactMarkdown>
        </>
      ) : (
        <>
          {/* Process thinking blocks for non-streaming mode */}
          {mainContent.split(/<think>([\s\S]*?)<\/think>/g).map((part, i) => {
            // Even indices are regular text, odd indices are thinking content
            return i % 2 === 0 ? (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={rendererComponents}
              >
                {part}
              </ReactMarkdown>
            ) : (
              <ThinkingBlock key={i}>{part}</ThinkingBlock>
            );
          })}
        </>
      )}
      {referencesContent && <ReferencesSection content={referencesContent} />}
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
