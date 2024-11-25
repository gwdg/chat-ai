// Importing necessary libraries and components
import React from "react";
import retry from "../../assets/icon_retry.svg";
import Typing from "../Others/Typing";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";

// ResponseItem component definition
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
    // Determine if this is the last response being processed
    const isLastResponse = index === responses.length - 1;

    return (
      <div className="p-2">
        {res.response ? (
          // Display the response if available
          <div
            className="text-black dark:text-white overflow-y-auto border dark:border-border_dark rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3"
            style={{
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            <MarkdownRenderer isDarkMode={isDarkModeGlobal}>
              {res.response}
            </MarkdownRenderer>
            <div className="flex justify-end w-full mt-1">
              <button className="">
                {copied && indexChecked === index ? (
                  <img
                    src={check}
                    alt="copy"
                    className="h-[20px] w-[20px] cursor-pointer"
                  />
                ) : (
                  <img
                    src={copy}
                    alt="copy"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(res.response);
                        setCopied(true);
                        setIndexChecked(index);
                      } catch (err) {
                        notifyError("Failed to copy text");
                      }
                    }}
                  />
                )}
              </button>
            </div>
          </div>
        ) : isLastResponse && (loading || loadingResend) ? (
          // If it's the last response and it's loading, display Typing animation
          <Typing />
        ) : (
          // Show "Try Again" if no response and not loading for non-last responses
          <div className="flex gap-2">
            <p>Try Again</p>
            <button onClick={() => handleRetryError(index)} disabled={loading}>
              <img src={retry} alt="Retry" />
            </button>
          </div>
        )}
      </div>
    );
  }
);

ResponseItem.displayName = "ResponseItem";

export default ResponseItem;
