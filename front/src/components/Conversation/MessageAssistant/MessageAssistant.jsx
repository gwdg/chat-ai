import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import Typing from "./Typing";
import CopyButton from "./CopyButton";
import Attachment from "../../Prompt/Attachment";
import EditButton from "./EditButton";

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

  useEffect(() => {
    setEditedText(message?.content[0]?.text || "")
  }, [editMode]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeightRefs());
  }, [editedText]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeight());
  }, [editedText, adjustHeight]);

  // Function to handle saving edited messages
  // Function to handle saving edited message
  const handleSave = () => {
    setLocalState((prev) => {
      let newMessages = [...prev.messages]
      newMessages[message_index].content[0].text = editedText;
      return { ...prev, messages: newMessages, flush: true };
    });
    setEditMode(false);
  };


    return (
        // Typing
        <div key={message_index} className={`text-black dark:text-white overflow-hidden border border-gray-200 dark:border-gray-800 
          rounded-2xl bg-bg_chat dark:bg-bg_chat_dark
          ${editMode ? "px-1 pt-1" : "px-3 pt-3"}`}>
        {/* Display dots when loading */}
        {loading && message.content[0].text === "" 
        ? (<Typing />) 
        : (<>
            {/* Edit Mode */}
            {editMode && (
            <div className="flex flex-col justify-between gap-1">
              <textarea
                ref={textareaRef}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="p-2 outline-none rounded-sm w-full text-sm dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-y overflow-y-auto"
                placeholder="Edit response..."
                style={{
                  minHeight: `${MIN_HEIGHT}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                }}
              />
              <div className="flex justify-end w-full gap-2 pb-2 px-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="text-sm text-gray-500 dark:text-gray-400 px-4 py-2 rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave()}
                  className="text-sm bg-tertiary text-white rounded-full px-4 py-2 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div> )}
            {/* Display message content */}
            {!editMode && (
            <>
            <MarkdownRenderer
                loading={loading}
                renderMode={renderMode}
            >
                {message.content[0]?.text}
            </MarkdownRenderer>
            {/* Bottom panel for message */}
            <div className="group flex justify-between w-full mt-1 gap-2">
              <div className="flex items-center justify-end mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {/* Render Mode Selector on the bottom left*/}
                <div className="flex h-8 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden ">
                {renderModes.map((mode) => (
                    <button
                    key={mode}
                    onClick={() => !loading && setRenderMode(mode)}
                    className={`px-2 py-1 text-xs font-medium transition-all duration-300 ease-in-out min-w-[60px] cursor-pointer select-none
                    ${loading ? "cursor-not-allowed opacity-40" : ""}
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
              <div className="flex items-center justify-end gap-3">
              <EditButton setEditMode={setEditMode} />
              <CopyButton message={message} />
              </div>
            </div></>)}
            </>
          )}
      {/* Attachments Section */}
      {Array.isArray(message?.content) && message?.content.length > 1 && (
          <div className="flex flex-wrap gap-2 pr-1 max-h-24 sm:max-h-28 md:max-h-40 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
          {message.content.slice(1).map((attachment, i) => (
              <Attachment
                  localState={localState}
                  setLocalState={setLocalState}
                  attachment={attachment}
                  index={i}
                  inHistory={true}
              />
          ))}
          </div>
      )}
    </div>
  );
});
