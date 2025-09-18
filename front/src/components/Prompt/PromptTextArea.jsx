
import { useEffect, useRef, useState } from "react";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";

import { useToast } from "../../hooks/useToast";
import { useDebounce } from "../../hooks/useDebounce";

import { useAttachments } from "../../hooks/useAttachments";

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default function PromptTextArea({
    localState,
    setLocalState,
    handleSend,
    handleChange,
    prompt,
    setPrompt
}) {
  const { t, i18n } = useTranslation();
  const textareaRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const { notifySuccess, notifyError } = useToast();
  const { addAttachments, pasteAttachments } = useAttachments();

  // Prompt is actually the last message's first content
  const attachments = localState.messages[localState.messages.length - 1].content.slice(1);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "56px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  // Handle file drop events for images and videos
  const handleDrop = async (e) => {
    e.preventDefault();
    addAttachments({
      localState,
      setLocalState,
      selectedFiles: Array.from(e.dataTransfer.files),
    });
    setIsDragging(false);
  };
  
  // Handle pasting images from clipboard
  const handlePaste = async (e) => {
    pasteAttachments({
      localState,
      setLocalState,
      notifyError,
      notifySuccess,
      clipboardData: e.clipboardData
    });
  };

  return (
    <div
    className="drag-drop-container relative"
    >
      {/* Drop Here text */}
      <span
        className={`
          absolute inset-0 flex items-center justify-center
          text-4xl font-bold 
          transition-opacity duration-300 ease-in-out
          pointer-events-none
          ${isDragging ? "opacity-80 " : "opacity-0"}
        `}
      >
        Drop Here
      </span>
      {/* Actual text area */}
      <textarea
          autoFocus
          ref={textareaRef}
          className="p-5 transition-opacity duration-300 ease-in-out outline-none text-base rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto"
          value={prompt}
          name="prompt"
          placeholder={t("conversation.prompt.placeholder")}
          style={{
          minHeight: `${MIN_HEIGHT}px`,
          maxHeight: `${MAX_HEIGHT}px`,
          opacity: isDragging ? 0.5 : 1
          }}
          onChange={(e) => {
            adjustHeight();
            handleChange(e);
          }}
          onDragOver={(e) => {e.preventDefault(); }}
          onDragEnter={(e) => {e.preventDefault(); setIsDragging(true);}}
          onDragLeave={(e) => {e.preventDefault(); setIsDragging(false);}}
          onDrop={handleDrop}
          onKeyDown={(event) => {
          if (
              event.key === "Enter" &&
              !event.shiftKey &&
              (prompt?.trim() !== "" || attachments.length > 0)
          ) {
              event.preventDefault();
              handleSend(event);
          }
          }}
          onPaste={handlePaste}
      />
    </div>
  );
}