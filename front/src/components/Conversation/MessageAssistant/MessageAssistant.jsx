import React, { useState, useEffect, useCallback, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import Typing from "./Typing";
import CopyButton from "./CopyButton";
import Attachment from "../../Prompt/Attachment";
import EditButton from "./EditButton";
import { RotateCw } from "lucide-react";
import { useSendMessage } from "../../../hooks/useSendMessage";
import MetaBox from "./MetaBox";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default React.memo(({ localState, setLocalState, message_index }) => {
  //Refs
  const assistantMessage = useRef(null);
  const editBox = useRef(null);
  const textareaRefs = useRef([]);
  const message = localState.messages[message_index];
  const loading = message?.loading || false;
  const [renderMode, setRenderMode] = useState("Default");
  // Define render modes with better styling
  const renderModes = ["Default", "Markdown", "LaTeX", "Plaintext"];
  const sendMessage = useSendMessage();

  //Functions
  const adjustHeight = () => {
    if (editBox.current) {
      editBox.current.style.height = `${MIN_HEIGHT}px`;

      const scrollHeight = editBox.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

      editBox.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState("");
  // Function to adjust textarea height for specific index
  const adjustHeightRefs = () => {
    // if (textareaRefs.current[index]) {
    //   const textarea = textareaRefs.current[index];
    //   textarea.style.height = `${MIN_HEIGHT}px`;
    //   const scrollHeight = textarea.scrollHeight;
    //   const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
    //   textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    // }
  };

  // Detect outside double clicks
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        assistantMessage.current &&
        !assistantMessage.current.contains(event.target)
      )
        setEditMode(false); // Exit edit mode
    }
    document.addEventListener("dblclick", handleClickOutside);
    return () => {
      document.removeEventListener("dblclick", handleClickOutside);
    };
  }, [setEditMode]);

  useEffect(() => {
    setEditedText(message?.content[0]?.text || "");
  }, [editMode]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeightRefs());
  }, [editedText]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeight());
  }, [editedText, adjustHeight]);

  // Function to handle saving edited message
  const handleSave = () => {
    setLocalState((prev) => {
      let newMessages = [...prev.messages];
      newMessages[message_index].content[0].text = editedText;
      return { ...prev, messages: newMessages, flush: true };
    });
    setEditMode(false);
  };

  // Function to handle resending a previous message
  const handleRetry = async () => {
    // Remove messages after current index

    setLocalState((prev) => {
      const newMessages = [...prev.messages];
      newMessages.splice(message_index);
      let newState = { ...prev, messages: newMessages };
      sendMessage({ localState: newState, setLocalState });
      return { ...prev, messages: newMessages };
    });
  };

  const content = message?.content?.[0]?.text ?? "";
  const isContentEmpty = !content.trim();
  return (
    <div
      key={message_index}
      ref={assistantMessage}
      className={`text-black dark:text-white overflow-hidden border border-gray-200 dark:border-gray-800 
          rounded-2xl bg-bg_chat dark:bg-bg_chat_dark
          ${editMode ? "px-1 pt-1" : "px-3 pt-3"}
          ${
            isContentEmpty && !loading
              ? "bg-bg_chat/50 dark:bg-bg_chat_dark/50 pt-0"
              : " bg-bg_chat dark:bg-bg_chat_dark"
          }`}
    >
      {isContentEmpty ? (
        <div
          className={`flex flex-col
            ${loading ? "pb-4" : "pb-3"}`}
        >
          {loading && <Typing />}
          {!loading && (
            <div className="flex flex-col items-center justify-start gap-3 py-1">
              <button
                onClick={handleRetry}
                className="cursor-pointer flex items-center gap-2 px-4 py-3 text-sm opacity-100 text-black dark:text-white bg-red-500/40 rounded-full hover:bg-red-400/100 transition-all"
                disabled={loading}
              >
                <RotateCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Edit Mode */}
          {editMode && (
            <div className="flex flex-col justify-between gap-1">
              <textarea
                ref={editBox}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    editBox.current.value?.trim() !== ""
                  ) {
                    event.preventDefault();
                    handleSave();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setEditMode(false);
                  }
                }}
                className="p-2 outline-none rounded-sm w-full text-sm dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-y overflow-y-auto"
                placeholder="Edit response..."
                style={{
                  minHeight: `${MIN_HEIGHT}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                }}
              />
              <div className="flex gap-4 justify-end w-full gap-2 pt-1 pb-2 px-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave()}
                  className="text-md text-primary border dark:text-tertiary rounded-full px-3 py-1 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          )}
          {/* Display message content */}
          {!editMode && (
            <div className="flex flex-col gap-4">
              <MarkdownRenderer isLoading={loading} renderMode={renderMode}>
                {message.content[0]?.text}
              </MarkdownRenderer>
              {/* Attachments Section */}
              {Array.isArray(message?.content) && message?.content.length > 1 && (
                <div className="flex flex-wrap gap-2 pr-1 pb-1 max-h-24 sm:max-h-28 md:max-h-40 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
                  {message.content.slice(1).map((attachment, i) => (
                    <Attachment
                      key={i}
                      localState={localState}
                      setLocalState={setLocalState}
                      attachment={attachment}
                      index={i}
                      inHistory={true}
                      inAssistant={true}
                    />
                  ))}
                </div>
              )}
              {/* Bottom panel for message */}
              <div className="group flex justify-between w-full mt-1 gap-2">
                <div className="flex items-center justify-end mb-2 opacity-30 group-hover:opacity-100 transition-opacity duration-300">
                  {/* Render Mode Selector on the bottom left*/}
                  <div className="flex h-8 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden ">
                    {renderModes.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => !loading && setRenderMode(mode)}
                        className={`px-2 py-1 text-xs font-medium transition-all duration-300 ease-in-out min-w-[60px] cursor-pointer select-none
                    ${loading ? "cursor-not-allowed opacity-20" : ""}
                    ${
                      renderMode === mode
                        ? "bg-tertiary text-white"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }
                    `}
                        disabled={loading}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buttons on the bottom right */}
                <div className="flex items-center justify-end gap-3 overflow-hidden">
                  { /* Show message metadata */
                  message?.meta && (
                    <MetaBox meta={message.meta} /> 
                  )}
                  <EditButton setEditMode={setEditMode} />
                  <CopyButton message={message} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
    </div>
  );
});
