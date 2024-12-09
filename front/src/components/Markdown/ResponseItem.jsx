import React from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";

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

    const handleCopy = () => {
      try {
        navigator.clipboard.writeText(res.response || "");
        setCopied(true);
        setIndexChecked(index);
      } catch (err) {
        notifyError("Failed to copy text");
      }
    };

    if (!res?.response && !showLoading) {
      return (
        <div className="flex gap-2 p-2">
          <p>Try Again</p>
          <button onClick={() => handleRetryError(index)} disabled={loading}>
            <img src="/retry.svg" alt="Retry" />
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
              <button className="hover:opacity-80" onClick={handleCopy}>
                <img
                  src={copied && indexChecked === index ? check : copy}
                  alt={copied && indexChecked === index ? "copied" : "copy"}
                  className="h-[20px] w-[20px] cursor-pointer"
                />
              </button>
            </div>
          </div>
        ) : (
          <div className="typing-indicator">...</div>
        )}
      </div>
    );
  }
);

ResponseItem.displayName = "ResponseItem";

export default ResponseItem;
