import React, { useCallback, useEffect } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";
import Typing from "../Others/Typing";

const ResponseItem = React.memo(
  ({
    res,
    index,
    isDarkModeGlobal,
    copied,
    indexChecked,
    setCopied,
    setIndexChecked,
    loading,
    loadingResend,
    responses,
  }) => {
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
        await navigator.clipboard.writeText(res.response);
        setCopied(true);
        setIndexChecked(index);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }, [res?.response, index, setCopied, setIndexChecked]);

    const isLastItem = index === responses.length - 1;

    // Show typing animation only for the last item when loading
    if ((loading || loadingResend) && isLastItem) {
      return <Typing />;
    }

    if (!res?.response) {
      return null;
    }

    return (
      <div className="p-2">
        <div className="text-black dark:text-white overflow-hidden border dark:border-border_dark rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3">
          <MarkdownRenderer isDarkMode={isDarkModeGlobal}>
            {res.response}
          </MarkdownRenderer>
          <div className="flex justify-end w-full mt-1">
            <button
              className="hover:opacity-80 p-1 rounded transition-opacity"
              onClick={handleCopy}
              aria-label={
                copied && indexChecked === index ? "Copied" : "Copy text"
              }
            >
              <img
                src={copied && indexChecked === index ? check : copy}
                alt={copied && indexChecked === index ? "copied" : "copy"}
                className="h-[20px] w-[20px]"
              />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ResponseItem.displayName = "ResponseItem";

export default ResponseItem;
