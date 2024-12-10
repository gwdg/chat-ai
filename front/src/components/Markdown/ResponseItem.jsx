import React, { useCallback, useEffect } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";
import retry from "../../assets/icon_retry.svg";

const ResponseItem = React.memo(
  ({
    res,
    index,
    handleRetryError,
    loading,
    loadingResend,
    responses,
    isDarkModeGlobal,
    copied,
    indexChecked,
    setCopied,
    setIndexChecked,
    notifyError,
  }) => {
    const isLastResponse = index === responses.length - 1;
    const showLoading = isLastResponse && (loading || loadingResend);

    // Reset copy state after 2 seconds
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
      if (!res?.response) {
        notifyError("No content to copy");
        return;
      }

      try {
        await navigator.clipboard.writeText(res.response);
        setCopied(true);
        setIndexChecked(index);
      } catch (err) {
        console.error('Copy failed:', err);
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = res.response;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setIndexChecked(index);
        } catch (fallbackErr) {
          notifyError("Failed to copy. Please try selecting and copying manually.");
        }
        document.body.removeChild(textArea);
      }
    }, [res?.response, index, setCopied, setIndexChecked, notifyError]);

    if (!res?.response && !showLoading) {
      return (
        <div className="flex gap-2 p-2">
          <p>Try Again</p>
          <button 
            onClick={() => handleRetryError(index)} 
            disabled={loading}
            className="disabled:opacity-50"
            aria-label="Retry"
          >
            <img src={retry} alt="Retry" className="w-5 h-5" />
          </button>
        </div>
      );
    }

    return (
      <div className="p-2">
        {res?.response ? (
          <div
            className="text-black dark:text-white overflow-hidden border dark:border-border_dark rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3"
            style={{ wordBreak: "break-word" }}
          >
            <MarkdownRenderer isDarkMode={isDarkModeGlobal}>
              {res.response}
            </MarkdownRenderer>
            <div className="flex justify-end w-full mt-1">
              <button 
                className="hover:opacity-80 p-1 rounded transition-opacity"
                onClick={handleCopy}
                aria-label={copied && indexChecked === index ? "Copied" : "Copy text"}
              >
                <img
                  src={copied && indexChecked === index ? check : copy}
                  alt={copied && indexChecked === index ? "copied" : "copy"}
                  className="h-[20px] w-[20px]"
                />
              </button>
            </div>
          </div>
        ) : (
          <div className="typing-indicator" role="status" aria-label="Loading response">
            ...
          </div>
        )}
      </div>
    );
  },
  // Custom comparison function for memo
  (prevProps, nextProps) => {
    return (
      prevProps.res?.response === nextProps.res?.response &&
      prevProps.loading === nextProps.loading &&
      prevProps.loadingResend === nextProps.loadingResend &&
      prevProps.copied === nextProps.copied &&
      prevProps.indexChecked === nextProps.indexChecked &&
      prevProps.isDarkModeGlobal === nextProps.isDarkModeGlobal
    );
  }
);

ResponseItem.displayName = "ResponseItem";

export default ResponseItem;




