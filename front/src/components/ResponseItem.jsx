// Importing necessary libraries and components
import React from "react";
import retry from "../assets/icon_retry.svg";
import Typing from "../components/Typing";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../assets/icon_copy.svg";
import check from "../assets/check.svg";

// ResponseItem component definition
const ResponseItem = React.memo(
  ({
    res,
    index,
    handleRetryError,
    loading,
    responses,
    isDarkModeGlobal,
    copied,
    indexChecked,
    setCopied,
    setIndexChecked,
    notifyError,
  }) => (
    <div className="p-2">
      {res.response ? (
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
      ) : !res.response && !loading ? (
        <div className="flex gap-2">
          <p>Try Again</p>
          <button
            onClick={(e) => handleRetryError(index, e)}
            disabled={loading}
          >
            <img src={retry} alt="Retry" />
          </button>
        </div>
      ) : (
        index === responses.length - 1 && loading && <Typing />
      )}
    </div>
  )
);

ResponseItem.displayName = "ResponseItem";

export default ResponseItem;
