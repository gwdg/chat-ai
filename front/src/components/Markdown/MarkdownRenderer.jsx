import { useState, useEffect, useRef, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import ThinkingBlock from "./ThinkingBlock";
import ReferencesSection from "./ReferencesSection";
import { rendererComponents } from "./rendererComponents";

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

  const latexExpressions = [];
  processedContent = processedContent.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g,
    (match) => {
      latexExpressions.push(match);
      return `<<LATEX_${latexExpressions.length - 1}>>`;
    }
  );

  processedContent = processedContent.replace(/\$(?=\d)/g, "\\$");

  processedContent = processedContent.replace(
    /<<LATEX_(\d+)>>/g,
    (_, index) => latexExpressions[parseInt(index)]
  );

  processedContent = processedContent.replace(
    /<<CODE_BLOCK_(\d+)>>/g,
    (_, index) => codeBlocks[parseInt(index)]
  );

  processedContent = processedContent
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");

  return processedContent;
};

// SMOOTH streaming processor with progressive reference handling
const useStreamingProcessor = (content, isLoading) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const [referencesStarted, setReferencesStarted] = useState(false);
  const [currentReferenceContent, setCurrentReferenceContent] = useState("");
  const [referencesSectionVisible, setReferencesSectionVisible] =
    useState(false);
  const bufferRef = useRef("");
  const processedIndexRef = useRef(0);
  const animationFrameRef = useRef(null);
  const mainContentRef = useRef("");
  const referenceStartIndexRef = useRef(-1);

  const processStreamingContent = useCallback(() => {
    if (!content || !isLoading) {
      setDisplayedText(content || "");
      setThinkingContent("");
      setIsThinking(false);
      setReferencesStarted(false);
      setCurrentReferenceContent("");
      setReferencesSectionVisible(false);
      bufferRef.current = "";
      processedIndexRef.current = 0;
      mainContentRef.current = "";
      referenceStartIndexRef.current = -1;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const processNextChunk = () => {
      const chunkSize = 30;
      let i = 0;

      while (i < chunkSize && processedIndexRef.current < content.length) {
        const char = content[processedIndexRef.current];
        bufferRef.current += char;

        // Check if we're entering references section during streaming
        if (!referencesStarted) {
          const hasReferencesHeader =
            /\n\s*#{1,3}\s*(references?|sources?)\s*\n/i.test(
              bufferRef.current
            ) ||
            /\n\s*(references?|sources?)\s*:?\s*\n/i.test(bufferRef.current);
          const hasSeparator = /\n\s*[-=]{3,}\s*\n/i.test(bufferRef.current);
          const hasRREF = /\[RREF\d+\]/i.test(bufferRef.current);

          if (hasReferencesHeader || (hasSeparator && hasRREF) || hasRREF) {
            console.log("🎯 References section starting - smooth transition");
            setReferencesStarted(true);
            setReferencesSectionVisible(true);

            // Find exact split point and clean up main content
            const lines = bufferRef.current.split("\n");
            let splitIndex = -1;

            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
              const line = lines[lineIdx].trim();
              if (
                /^#{1,3}\s*(references?|sources?)\s*$/i.test(line) ||
                /^(references?|sources?)\s*:?\s*$/i.test(line) ||
                /^[-=]{3,}$/.test(line) ||
                /^\s*\[RREF\d+\]/i.test(line)
              ) {
                // Look back for logical break
                for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 3); j--) {
                  if (
                    lines[j].trim() === "" ||
                    /^[-=]{2,}$/.test(lines[j].trim())
                  ) {
                    splitIndex = j;
                    break;
                  }
                }
                if (splitIndex === -1) splitIndex = lineIdx;
                break;
              }
            }

            if (splitIndex !== -1) {
              const mainLines = lines.slice(0, splitIndex);

              // CRITICAL FIX: Clean up any reference-related content from main content
              while (mainLines.length > 0) {
                const lastLine = mainLines[mainLines.length - 1].trim();
                if (
                  lastLine === "" ||
                  /^[-=]{2,}$/.test(lastLine) ||
                  /^(references?|sources?)\s*:?\s*$/i.test(lastLine) ||
                  /^#{1,3}\s*(references?|sources?)\s*$/i.test(lastLine) ||
                  /\[RREF\d+\]/i.test(lastLine) // Remove any RREF content from main
                ) {
                  mainLines.pop();
                } else {
                  break;
                }
              }

              // Set clean main content immediately
              mainContentRef.current = mainLines.join("\n").trim();
              setDisplayedText(mainContentRef.current);
              referenceStartIndexRef.current = splitIndex;
            }
          }
        }

        // Handle thinking blocks (unchanged)
        if (bufferRef.current.includes("<think>") && !referencesStarted) {
          const [beforeThink] = bufferRef.current.split("<think>");
          setDisplayedText(beforeThink);
          setIsThinking(true);
          bufferRef.current = "";
        } else if (bufferRef.current.includes("</think>")) {
          const [thinkContent] = bufferRef.current.split("</think>");
          setThinkingContent(thinkContent);
          setIsThinking(false);
          bufferRef.current = "";

          if (!referencesStarted) {
            setDisplayedText(mainContentRef.current || bufferRef.current);
          }
        } else if (!isThinking && !referencesStarted) {
          // Update main content normally - but stop before any reference content
          const currentBuffer = bufferRef.current;

          // Check if we have any reference indicators and exclude them
          let cleanContent = currentBuffer;
          const rrefMatch = cleanContent.match(
            /^([\s\S]*?)(?=\n\s*[-=]{3,}|\n\s*#{1,3}\s*(?:references?|sources?)|\n\s*(?:references?|sources?)\s*:|\[RREF\d+\])/i
          );

          if (rrefMatch) {
            cleanContent = rrefMatch[1].trim();
          }

          setDisplayedText(cleanContent);
          mainContentRef.current = cleanContent;
        } else if (isThinking && !referencesStarted) {
          setThinkingContent((prev) => prev + char);
        } else if (referencesStarted) {
          // We're in references section - update reference content progressively
          const lines = bufferRef.current.split("\n");
          if (referenceStartIndexRef.current !== -1) {
            const referenceLines = lines.slice(referenceStartIndexRef.current);
            const currentRefContent = referenceLines.join("\n");
            setCurrentReferenceContent(currentRefContent);
          }
        }

        processedIndexRef.current++;
        i++;
      }

      if (processedIndexRef.current < content.length) {
        animationFrameRef.current = requestAnimationFrame(processNextChunk);
      } else {
        console.log("✅ Streaming complete");
      }
    };

    if (processedIndexRef.current === 0) {
      setDisplayedText("");
      setThinkingContent("");
      setIsThinking(false);
      setReferencesStarted(false);
      setCurrentReferenceContent("");
      setReferencesSectionVisible(false);
      bufferRef.current = "";
      mainContentRef.current = "";
      referenceStartIndexRef.current = -1;
    }

    animationFrameRef.current = requestAnimationFrame(processNextChunk);
  }, [content, isLoading, isThinking, referencesStarted]);

  useEffect(() => {
    processStreamingContent();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [processStreamingContent]);

  return {
    displayedText,
    isThinking,
    thinkingContent,
    referencesStarted,
    currentReferenceContent,
    referencesSectionVisible,
  };
};

// Enhanced content extraction that properly handles streaming states
const extractContentAndReferences = (content) => {
  if (!content) return { mainContent: "", referencesContent: "" };

  try {
    const rrefMatches = content.match(/\[RREF\d+\]/gi);
    if (!rrefMatches || rrefMatches.length === 0) {
      return { mainContent: content, referencesContent: "" };
    }

    const lines = content.split("\n");
    let referenceStartIndex = -1;

    // Find reference section start with more precise detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for explicit reference headers
      if (
        /^-{3,}$/.test(line) ||
        /^={3,}$/.test(line) ||
        /^(references?|sources?|citations?)\s*:?\s*$/i.test(line) ||
        /^#{1,3}\s*(references?|sources?|citations?)\s*$/i.test(line)
      ) {
        let hasRrefAfter = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (/\[RREF\d+\]/i.test(lines[j])) {
            hasRrefAfter = true;
            break;
          }
        }

        if (hasRrefAfter) {
          referenceStartIndex = i;
          break;
        }
      }
    }

    // If no explicit header, find first RREF line
    if (referenceStartIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^\s*\[RREF\d+\]/i.test(line)) {
          let separationPoint = i;

          // Look back for logical separation
          for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
            const prevLine = lines[j].trim();
            if (
              prevLine === "" ||
              /^[-=]{2,}$/.test(prevLine) ||
              /^(references?|sources?)\s*:?\s*$/i.test(prevLine)
            ) {
              separationPoint = j;
              break;
            }
          }
          referenceStartIndex = separationPoint;
          break;
        }
      }
    }

    if (referenceStartIndex === -1) {
      return { mainContent: content, referencesContent: "" };
    }

    const mainLines = lines.slice(0, referenceStartIndex);
    const referenceLines = lines.slice(referenceStartIndex);

    // ENHANCED: Aggressively clean main content of reference artifacts
    while (mainLines.length > 0) {
      const lastLine = mainLines[mainLines.length - 1].trim();
      if (
        lastLine === "" ||
        /^[-=]{3,}$/.test(lastLine) ||
        /^(references?|sources?)\s*:?\s*$/i.test(lastLine) ||
        /^#{1,3}\s*(references?|sources?)\s*$/i.test(lastLine) ||
        /\[RREF\d+\]/i.test(lastLine) || // Remove any RREF content
        lastLine.toLowerCase().includes("reference") // Remove any line mentioning references
      ) {
        mainLines.pop();
      } else {
        break;
      }
    }

    const mainContent = mainLines.join("\n").trim();
    const referencesContent = referenceLines.join("\n").trim();

    if (referencesContent && /\[RREF\d+\]/i.test(referencesContent)) {
      return { mainContent, referencesContent };
    }

    return { mainContent: content, referencesContent: "" };
  } catch (error) {
    console.error("Error in content extraction:", error);
    return { mainContent: content, referencesContent: "" };
  }
};

const MarkdownRenderer = memo(
  ({ children, isDarkMode, isLoading, renderMode = "Default" }) => {
    // Single useEffect for KaTeX styling
    useEffect(() => {
      const style = document.createElement("style");
      style.textContent = `
        .katex-display {
          display: flex !important;
          justify-content: center !important;
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
      thinkingContent,
      referencesStarted,
      currentReferenceContent,
      referencesSectionVisible,
    } = useStreamingProcessor(children, isLoading);

    if (!children) return null;

    // Extract content for main display
    // eslint-disable-next-line no-unused-vars
    const { mainContent, referencesContent } = extractContentAndReferences(
      isLoading ? displayedText : children
    );

    // Get the reference content to pass to ReferencesSection
    const referencesToShow = isLoading
      ? currentReferenceContent // Show progressive content during streaming
      : extractContentAndReferences(children).referencesContent; // Show full content when complete

    console.log("🎬 Streaming state:", {
      isLoading,
      referencesStarted,
      referencesSectionVisible,
      currentRefLength: currentReferenceContent.length,
      finalRefLength: referencesToShow.length,
      mainContentLength: mainContent.length,
    });

    // Configure KaTeX options
    const katexOptions = {
      output: "htmlAndMathml",
      throwOnError: false,
      trust: true,
      strict: false,
      macros: {
        "\\f": "#1f(#2)",
      },
    };

    // Safe wrapper for ReactMarkdown
    const SafeMarkdown = ({ children: markdownContent, ...props }) => {
      try {
        if (!markdownContent || markdownContent.trim() === "") {
          return null;
        }

        const sanitizedContent = markdownContent
          .replace(/<meta\s+([^>]*)>/gi, (match, attrs) => {
            return `\\<meta ${attrs}\\>`;
          })
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
          .replace(/<([^>]+)>/gi, (match, tagContent) => {
            return `\\<${tagContent}\\>`;
          })
          .replace(/javascript:/gi, "javascript-protocol:")
          .replace(/\son(\w+)\s*=\s*([^>\s]*)/gi, (match, event, handler) => {
            return ` data-on${event}="${handler}"`;
          });

        return <ReactMarkdown {...props}>{sanitizedContent}</ReactMarkdown>;
      } catch (error) {
        console.error("Error rendering markdown:", error);
        return (
          <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            Error rendering content: {error.message}
          </div>
        );
      }
    };

    if (renderMode === "Plain Text") {
      return (
        <>
          <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
            {isLoading && thinkingContent && (
              <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
            )}

            <pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto">
              {isLoading ? displayedText : mainContent}
            </pre>
          </div>

          {/* Progressive References Section */}
          {(referencesSectionVisible || referencesToShow) && (
            <ReferencesSection
              content={referencesToShow}
              isLoading={isLoading}
              isStreaming={referencesStarted && isLoading}
            />
          )}
        </>
      );
    }

    // LaTeX-only mode
    if (renderMode === "LaTeX") {
      const latexOnlyComponents = {
        ...rendererComponents,
        p: ({ children }) => (
          <p className="mb-3 font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">
            {children}
          </p>
        ),
        h1: ({ children }) => (
          <div className="text-lg font-mono font-bold mt-4 mb-2 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            # {children}
          </div>
        ),
        h2: ({ children }) => (
          <div className="text-md font-mono font-semibold mt-3 mb-2 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            ## {children}
          </div>
        ),
        h3: ({ children }) => (
          <div className="text-sm font-mono font-medium mt-2 mb-1 bg-gray-100 dark:bg-gray-800 p-2 rounded">
            ### {children}
          </div>
        ),
        code: ({ inline, className, children }) => {
          const content = String(children).replace(/\n$/, "");
          if (inline) {
            return (
              <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                `{content}`
              </code>
            );
          }
          return (
            <pre className="font-mono bg-gray-100 dark:bg-gray-800 p-3 rounded mt-2 mb-2 text-xs overflow-x-auto">
              ```{className?.replace("language-", "") || ""}
              {"\n"}
              {content}
              {"\n"}```
            </pre>
          );
        },
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
      };

      return (
        <>
          <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
            {isLoading && thinkingContent && (
              <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
            )}

            {(isLoading ? displayedText : mainContent)
              .split(/<think>([\s\S]*?)<\/think>/g)
              .map((part, i) => {
                return i % 2 === 0 ? (
                  <SafeMarkdown
                    key={`part-${i}`}
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                    components={latexOnlyComponents}
                  >
                    {preprocessLaTeX(part)}
                  </SafeMarkdown>
                ) : (
                  <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
                );
              })}
          </div>

          {/* Progressive References Section */}
          {(referencesSectionVisible || referencesToShow) && (
            <ReferencesSection
              content={referencesToShow}
              isLoading={isLoading}
              isStreaming={referencesStarted && isLoading}
            />
          )}
        </>
      );
    }

    // Markdown mode
    if (renderMode === "Markdown") {
      const markdownModeComponents = {
        ...rendererComponents,
        math: ({ value }) => <code className="text-pink-500">${value}$</code>,
        inlineMath: ({ value }) => (
          <code className="text-pink-500">${value}$</code>
        ),
      };

      return (
        <>
          <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
            {isLoading && thinkingContent && (
              <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
            )}

            {(isLoading ? displayedText : mainContent)
              .split(/<think>([\s\S]*?)<\/think>/g)
              .map((part, i) => {
                return i % 2 === 0 ? (
                  <SafeMarkdown
                    key={`part-${i}`}
                    remarkPlugins={[remarkGfm]}
                    components={markdownModeComponents}
                  >
                    {part}
                  </SafeMarkdown>
                ) : (
                  <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
                );
              })}
          </div>

          {/* Progressive References Section */}
          {(referencesSectionVisible || referencesToShow) && (
            <ReferencesSection
              content={referencesToShow}
              isLoading={isLoading}
              isStreaming={referencesStarted && isLoading}
            />
          )}
        </>
      );
    }

    // Default mode - full rendering with smooth references
    return (
      <>
        <div className={`markdown-body ${isDarkMode ? "dark" : "light"}`}>
          {isLoading && thinkingContent && (
            <ThinkingBlock autoExpand={true}>{thinkingContent}</ThinkingBlock>
          )}

          {/* Main content - clean separation from references */}
          {(isLoading ? displayedText : mainContent)
            .split(/<think>([\s\S]*?)<\/think>/g)
            .map((part, i) => {
              return i % 2 === 0 ? (
                <SafeMarkdown
                  key={`part-${i}`}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                  components={rendererComponents}
                >
                  {preprocessLaTeX(part)}
                </SafeMarkdown>
              ) : (
                <ThinkingBlock key={`think-${i}`}>{part}</ThinkingBlock>
              );
            })}
        </div>

        {/* Progressive References Section - appears immediately when references start */}
        {(referencesSectionVisible || referencesToShow) && (
          <ReferencesSection
            content={referencesToShow}
            isLoading={isLoading}
            isStreaming={referencesStarted && isLoading}
          />
        )}
      </>
    );
  }
);

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
