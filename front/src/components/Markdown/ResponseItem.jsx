import React, { useCallback, useEffect, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";
import Typing from "../Others/Typing";
import edit_icon from "../../assets/edit_icon.svg";
import ErrorBoundary from "./ErrorBoundary";
import { RotateCw } from "lucide-react";

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

    const handleCopy = useCallback(async () => {
      try {
        let textToCopy = res.response;
        // Remove thinking tags and their content
        textToCopy = textToCopy.replace(/<think>[\s\S]*?<\/think>/g, "");
        // Remove everything after References:
        textToCopy = textToCopy.split("References:")[0];
        // Remove userStyle tags and their content
        textToCopy = textToCopy.replace(
          /<userStyle>[\s\S]*?<\/userStyle>/g,
          ""
        );
        // Remove dashed lines
        textToCopy = textToCopy.replace(/^-+$/gm, "");
        // Clean up extra newlines and whitespace
        textToCopy = textToCopy.replace(/\n{3,}/g, "\n\n").trim();

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

    // Return early with error state if no response and not loading
    if (hasError) {
      return (
        <div className="p-2" ref={responseRef}>
          <div className="text-black dark:text-white overflow-hidden border dark:border-border_dark rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3">
            <div className="flex flex-col items-start  py-2">
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
                    className="p-2 outline-none rounded-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-y overflow-hidden"
                    placeholder="Edit response..."
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
                      Save (⌘/Ctrl + Enter)
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
                    >
                      {res.response}
                    </MarkdownRenderer>
                  </ErrorBoundary>
                  <div className="flex justify-end w-full mt-1 gap-2">
                    <button
                      onClick={() => handleResponseEdit(index, res.response)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      title="Edit (double click)"
                    >
                      <img
                        src={edit_icon}
                        alt="edit"
                        className="h-[22px] w-[22px]"
                      />
                    </button>
                    <button onClick={handleCopy} title="Copy to clipboard">
                      <img
                        src={copied && indexChecked === index ? check : copy}
                        alt="copy"
                        className="h-[20px] w-[20px]"
                      />
                    </button>
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
