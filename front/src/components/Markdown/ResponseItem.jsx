import React, { useCallback, useEffect, useRef, useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";
import Typing from "../Others/Typing";
import edit_icon from "../../assets/edit_icon.svg";
import ErrorBoundary from "./ErrorBoundary";
import { RotateCw } from "lucide-react";

const MAX_HEIGHT = 400;
const MIN_HEIGHT = 350;

// Helper function to extract main content (without references) for copying
const extractMainContentForCopy = (content) => {
  if (!content) return "";

  try {
    // Remove thinking blocks
    let textToCopy = content.replace(/<think>[\s\S]*?<\/think>/g, "");

    // Remove user style blocks
    textToCopy = textToCopy.replace(/<userStyle>[\s\S]*?<\/userStyle>/g, "");

    // Strategy 1: Look for explicit reference sections and remove everything after
    const explicitPatterns = [
      /\n\s*-{3,}\s*\n\s*References?:\s*\n/i,
      /\n\s*={3,}\s*\n\s*References?:\s*\n/i,
      /\n\s*References?:\s*\n\s*-{3,}/i,
      /\n\s*#{1,3}\s*References?\s*\n/i,
    ];

    for (const pattern of explicitPatterns) {
      const match = textToCopy.match(pattern);
      if (match) {
        textToCopy = textToCopy.substring(0, match.index);
        break;
      }
    }

    // Strategy 2: Find first actual reference line (not just text containing RREF)
    const lines = textToCopy.split("\n");
    let cutoffIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line is an actual reference (starts with RREF or has RREF at beginning)
      if (
        /^\s*\[RREF\d+\]/.test(line) ||
        (/\[RREF\d+\]/.test(line) && line.trim().indexOf("[RREF") < 10)
      ) {
        cutoffIndex = i;
        break;
      }
    }

    if (cutoffIndex !== -1) {
      // Look backwards from cutoff to find logical separation
      for (let i = cutoffIndex - 1; i >= Math.max(0, cutoffIndex - 10); i--) {
        const line = lines[i].trim();
        if (
          /^[-=_*]{3,}$/.test(line) ||
          /^(references?|sources?)\s*:?\s*$/i.test(line) ||
          (line === "" && i > 0 && lines[i - 1].trim() === "")
        ) {
          cutoffIndex = i;
          break;
        }
      }

      textToCopy = lines.slice(0, cutoffIndex).join("\n");
    }

    // Remove any remaining RREF patterns that might have leaked through
    textToCopy = textToCopy.replace(/\[RREF\d+\]/gi, "");

    // Clean up multiple consecutive newlines
    textToCopy = textToCopy.replace(/\n{3,}/g, "\n\n");

    // Remove horizontal rules at the end
    textToCopy = textToCopy.replace(/^-+$/gm, "");

    // Remove trailing empty lines and separators
    const finalLines = textToCopy.split("\n");
    while (finalLines.length > 0) {
      const lastLine = finalLines[finalLines.length - 1].trim();
      if (
        lastLine === "" ||
        /^[-=_*]{3,}$/.test(lastLine) ||
        /^(references?|sources?)\s*:?\s*$/i.test(lastLine)
      ) {
        finalLines.pop();
      } else {
        break;
      }
    }

    return finalLines.join("\n").trim();
  } catch (error) {
    console.error("Error extracting main content:", error);
    // Fallback - just remove obvious reference patterns
    return content
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/<userStyle>[\s\S]*?<\/userStyle>/g, "")
      .replace(/\[RREF\d+\][\s\S]*/i, "")
      .replace(/^-+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
};

const ResponseItem = React.memo(
  ({
    res,
    index,
    isDarkModeGlobal,
    copied,
    setCopied,
    indexChecked,
    setIndexChecked,
    loading,
    loadingResend,
    responses,
    editingResponseIndex,
    setEditedResponse,
    handleResponseEdit,
    handleResponseSave,
    editedResponse,
    setEditingResponseIndex,
    handleResendClick,
  }) => {
    const responseRef = useRef(null);
    const textareaRef = useRef(null);
    const lastEditingIndex = useRef(-1);
    const [renderMode, setRenderMode] = useState("Default");

    const adjustTextareaHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "1px";
        textareaRef.current.style.height = `${
          25 + textareaRef.current.scrollHeight
        }px`;
      }
    };

    useEffect(() => {
      adjustTextareaHeight();
    }, [editedResponse]);

    useEffect(() => {
      const handleKeyDown = (e) => {
        if (editingResponseIndex === index) {
          if (e.key === "Escape") {
            setEditingResponseIndex(-1);
          } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            handleResponseSave(index);
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [
      editingResponseIndex,
      index,
      handleResponseSave,
      setEditingResponseIndex,
    ]);

    useEffect(() => {
      if (
        editingResponseIndex === index &&
        editingResponseIndex !== lastEditingIndex.current &&
        textareaRef.current
      ) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = editedResponse.length;
        textareaRef.current.selectionEnd = editedResponse.length;
      }
      lastEditingIndex.current = editingResponseIndex;
    }, [editingResponseIndex, index, editedResponse.length]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          responseRef.current &&
          !responseRef.current.contains(event.target) &&
          textareaRef.current &&
          !textareaRef.current.contains(event.target)
        ) {
          setEditingResponseIndex(-1);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, [setEditingResponseIndex]);

    useEffect(() => {
      if (copied && indexChecked === index) {
        const timer = setTimeout(() => {
          setCopied(false);
          setIndexChecked(-1);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }, [copied, indexChecked, index, setCopied, setIndexChecked]);

    // Enhanced copy function that properly excludes references
    const handleCopy = useCallback(async () => {
      try {
        const textToCopy = extractMainContentForCopy(res.response);

        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setIndexChecked(index);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }, [res?.response, index, setCopied, setIndexChecked]);

    const isLastItem = index === responses.length - 1;
    const isLoading = (loading || loadingResend) && isLastItem;
    const hasError = !res?.response && !isLoading;

    // Define render modes with better styling
    const renderModes = ["Default", "Markdown", "LaTeX", "Plain Text"];

    if (hasError) {
      return (
        <div className="p-2" ref={responseRef}>
          <div className="text-black dark:text-white overflow-hidden border dark:border-border_dark rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3">
            <div className="flex flex-col items-start py-2">
              <button
                onClick={() => handleResendClick(index)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-tertiary rounded-lg hover:bg-tertiary/90 transition-colors"
                disabled={isLoading}
              >
                <RotateCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-2" ref={responseRef}>
        <div className="text-black dark:text-white overflow-hidden border dark:border-border_dark rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3">
          {!res?.response && isLoading ? (
            <Typing />
          ) : (
            <>
              {editingResponseIndex === index ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    ref={textareaRef}
                    value={editedResponse}
                    onChange={(e) => setEditedResponse(e.target.value)}
                    className="p-2 outline-none rounded-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-y overflow-y-auto"
                    placeholder="Edit response..."
                    style={{
                      minHeight: `${MIN_HEIGHT}px`,
                      maxHeight: `${MAX_HEIGHT}px`,
                    }}
                  />
                  <div className="flex justify-end w-full gap-2">
                    <button
                      onClick={() => setEditingResponseIndex(-1)}
                      className="text-gray-500 dark:text-gray-400 px-4 py-2 rounded-2xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleResponseSave(index)}
                      className="bg-tertiary text-white rounded-2xl px-4 py-2"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <ErrorBoundary
                    fallback={
                      <div className="flex flex-col items-center justify-center gap-3 py-4">
                        <p className="text-red-500 dark:text-red-400">
                          Error rendering response
                        </p>
                        <button
                          onClick={() => handleResendClick(index)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-tertiary rounded-lg hover:bg-tertiary/90 transition-colors"
                          disabled={isLoading}
                        >
                          <RotateCw className="w-4 h-4" />
                          Try Again
                        </button>
                      </div>
                    }
                  >
                    <MarkdownRenderer
                      isDarkMode={isDarkModeGlobal}
                      isLoading={isLoading}
                      renderMode={renderMode}
                    >
                      {res.response}
                    </MarkdownRenderer>
                  </ErrorBoundary>
                  <div className="flex justify-between w-full mt-1 gap-2">
                    {/* Render mode selection with updated styling for 4 modes */}
                    <div className="flex items-center justify-end mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="flex h-8 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
                        {renderModes.map((mode) => (
                          <button
                            key={mode}
                            onClick={() => !isLoading && setRenderMode(mode)}
                            className={`px-2 py-1 text-xs font-medium transition-all duration-300 ease-in-out min-w-[60px]
                            ${isLoading ? "cursor-not-allowed opacity-50" : ""}
                            ${
                              renderMode === mode
                                ? "bg-tertiary text-white"
                                : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                            }
                          `}
                            disabled={isLoading}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleResponseEdit(index, res.response)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        title="Edit"
                        disabled={isLoading}
                      >
                        <img
                          src={edit_icon}
                          alt="edit"
                          className="h-[22px] w-[22px]"
                        />
                      </button>
                      <button
                        onClick={handleCopy}
                        title="Copy response (without references)"
                      >
                        <img
                          src={copied && indexChecked === index ? check : copy}
                          alt="copy"
                          className="h-[20px] w-[20px]"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

ResponseItem.displayName = "ResponseItem";

export default ResponseItem;
