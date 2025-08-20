import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import Typing from "./Typing";
import CopyButton from "./CopyButton";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default React.memo(({ localState, setLocalState, message_index }) => {
  //Refs
  const textareaRef = useRef(null);
  const textareaRefs = useRef([]);
  const message = localState.messages[message_index];
  const loading = message?.loading || false;
  const [renderMode, setRenderMode] = useState("Default");
  // Define render modes with better styling
  const renderModes = ["Default", "Markdown", "LaTeX", "Plain Text"];

  //Functions
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;

      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

      textareaRef.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState("");
  // Function to adjust textarea height for specific index
  const adjustHeightRefs = (index) => {
    if (textareaRefs.current[index]) {
      const textarea = textareaRefs.current[index];
      textarea.style.height = `${MIN_HEIGHT}px`;
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
      textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  useEffect(() => {
    if (editingIndex !== null) {
      // Use requestAnimationFrame for smoother height adjustments
      requestAnimationFrame(() => adjustHeightRefs(editingIndex));
    }
  }, [editedText, editingIndex]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeight());
  }, [editedText, adjustHeight]);

  // Function to handle editing message at specific index
  const handleEditClick = (index, prompt) => {
    setEditingResponseIndex(-1);
    setEditedText(prompt);
    setEditingIndex(index);
    // Focus after state updates
    setTimeout(() => {
      if (textareaRefs.current[index]) {
        const textarea = textareaRefs.current[index];
        textarea.focus();
        textarea.selectionStart = prompt.length;
        textarea.selectionEnd = prompt.length;
      }
    }, 0);
  };

  //Functions
  const handleResponseEdit = (index, response) => {
    setEditingIndex(-1);
    setEditedResponse(response);
    setEditingResponseIndex(index);
  };

  // Function to handle saving edited messages
  const handleSave = async (index) => {
    await sendMessage({
      localState,
      setLocalState,
      openModal,
      operationType: "edit",
      index,
      editedText, // Make sure this variable is available in your component scope
      dispatch,
      setLoadingResend,
      modelsData,
      memories,
      updateMemory,
      timeoutTime,
    });
  };

  return (
    // Typing
    <div
      key={message_index}
      className="text-black dark:text-white overflow-hidden border border-gray-200 dark:border-gray-800 rounded-2xl bg-bg_chat dark:bg-bg_chat_dark p-3"
    >
      {/* Display dots when loading */}
      {loading && message.content[0].data === "" ? (
        <Typing />
      ) : (
        <>
          {/* Display message content */}
          <MarkdownRenderer loading={loading} renderMode={renderMode}>
            {message.content[0]?.data}
          </MarkdownRenderer>
          {/* Bottom panel for message */}
          <div className="flex items-center justify-between mb-2 opacity-100 group-hover:opacity-100 transition-opacity duration-300">
            {/* Render Mode Selector */}
            <div className="flex h-8 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden ">
              {renderModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => !loading && setRenderMode(mode)}
                  className={`px-2 py-1 text-xs font-medium transition-all duration-300 ease-in-out min-w-[60px] cursor-pointer select-none
                            ${loading ? "cursor-not-allowed opacity-50" : ""}
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
            {/* Copy Button */}
            <CopyButton message={message} />
          </div>
        </>
      )}

      {/* File rendering */}
      {/* <MessageContainer
            localState={localState}
            message={message}
            index={index}
            copied={copied}
            setCopied={setCopied}
            indexChecked={indexChecked}
            setIndexChecked={setIndexChecked}
            loading={loading}
            loadingResend={loadingResend}
            editingResponseIndex={editingResponseIndex}
            setEditedResponse={setEditedResponse}
            handleResponseEdit={handleResponseEdit}
            editedResponse={editedResponse}
            setEditingResponseIndex={setEditingResponseIndex}
            handleResendClick={handleRetryClick}
        /> */}
    </div>
  );
});
