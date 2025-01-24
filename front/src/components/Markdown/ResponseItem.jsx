import React, { useCallback, useEffect, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import copy from "../../assets/icon_copy.svg";
import check from "../../assets/check.svg";
import Typing from "../Others/Typing";
import edit_icon from "../../assets/edit_icon.svg";

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
  }) => {
    //Refs
    const responseRef = useRef(null);
    const textareaRef = useRef(null);
    const lastEditingIndex = useRef(-1);

    const adjustTextareaHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "1px";
        textareaRef.current.style.height =
          25 + textareaRef.current.scrollHeight + "px";
      }
    };

    useEffect(() => {
      adjustTextareaHeight();
    }, [editedResponse]);

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
        await navigator.clipboard.writeText(res.response);
        setCopied(true);
        setIndexChecked(index);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }, [res?.response, index, setCopied, setIndexChecked]);

    const isLastItem = index === responses.length - 1;
    const isLoading = (loading || loadingResend) && isLastItem;

    if (!res?.response && !isLoading) {
      return null;
    }

    return (
      <div className="p-2" ref={responseRef}>
        <div className="text-black dark:text-white overflow-hidden border dark:border-border_dark rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3">
          {!res?.response && isLoading && <Typing />}
          {res?.response && (
            <>
              {editingResponseIndex === index ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    ref={textareaRef}
                    value={editedResponse}
                    onChange={(e) => setEditedResponse(e.target.value)}
                    className="p-2 outline-none rounded-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-y overflow-hidden"
                  />

                  <div className="flex justify-end w-full">
                    {" "}
                    <button
                      onClick={() => handleResponseSave(index)}
                      className="bg-tertiary  text-white rounded-2xl p-2 w-fit"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <MarkdownRenderer isDarkMode={isDarkModeGlobal}>
                    {res.response}
                  </MarkdownRenderer>
                  <div className="flex justify-end w-full mt-1 gap-2 group">
                    <button
                      onClick={() => {
                        handleResponseEdit(index, res.response);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    >
                      <img
                        src={edit_icon}
                        alt="edit"
                        className="h-[22px] w-[22px]"
                      />
                    </button>
                    <button onClick={handleCopy}>
                      <img
                        src={copied && indexChecked === index ? check : copy}
                        alt="copy"
                        className="h-[20px] w-[20px]"
                      />
                    </button>
                  </div>
                </>
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
