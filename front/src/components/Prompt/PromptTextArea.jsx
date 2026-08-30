
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "../../hooks/useToast";

import { useAttachments } from "../../hooks/useAttachments";
import ClearButton from "./ClearButton";

const MIN_HEIGHT = 56;
const MAX_HEIGHT = 200;
const MIN_HEIGHT_MD = 80;
const MAX_HEIGHT_MD = 300;

export default function PromptTextArea({
    localState,
    setLocalState,
    handleSend,
    handleChange,
    prompt,
}) {
  const { t } = useTranslation();
  const textareaRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const { notifySuccess, notifyError } = useToast();
  const { addAttachments, pasteAttachments } = useAttachments();

  // Prompt is actually the last message's first content
  const lastMessage = localState?.messages?.[localState.messages.length - 1];
  const attachments = Array.isArray(lastMessage?.content)
    ? lastMessage.content.slice(1)
    : [];
  const choices = Array.isArray(localState?.choices) ? localState.choices : [];

  const adjustHeight = () => {
    if (textareaRef.current) {
      const isMd = window.matchMedia("(min-width: 768px)").matches; // read fresh each time
      textareaRef.current.style.height = `${isMd ? MIN_HEIGHT_MD : MIN_HEIGHT}px`;
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, isMd ? MIN_HEIGHT_MD : MIN_HEIGHT), isMd? MAX_HEIGHT_MD : MAX_HEIGHT)}px`;
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

  useEffect(() => {
    adjustHeight();
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);

    // cleanup: remove listener when component unmounts
    return () => window.removeEventListener("resize", handleResize);
  }, [prompt]);

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
    {choices.length > 0 && (
      <div className="px-5 pt-4 pb-2 choice-bar-enter">
        <div
          className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {choices.map((choice, index) => (
            <button
              key={`${index}-${choice}`}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleSend(event, choice);
              }}
              title={choice}
              className="shrink-0 max-w-[75vw] sm:max-w-[22rem]
                         inline-flex items-center cursor-pointer rounded-full border border-gray-200 dark:border-gray-700 choice-chip-enter
                         bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-xs font-medium
                         text-gray-700 dark:text-gray-200
                         hover:bg-gray-100 dark:hover:bg-gray-800
                         active:scale-95 transition"
              style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
            >
              <span className="truncate">{choice}</span>
            </button>
          ))}
        </div>
      </div>
    )}
      {/* Actual text area */}
      <div className = "relative">
        {/* Floating buttons - top right over the text */}
        <div className="absolute top-2 right-3 z-10 flex gap-2 items-center">
          {/* Clear Button */}
          <ClearButton
            localState={localState}
            setLocalState={setLocalState}
          />
        </div>
        <textarea
            autoFocus
            ref={textareaRef}
            className={`p-4 md:p-5 transition-opacity duration-300 ease-in-out outline-none text-base w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto ${
              choices.length > 0 ? "" : "rounded-t-2xl"
            }`}
            value={prompt}
            name="prompt"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-1p-ignore="true"
            placeholder={t("conversation.prompt.placeholder")}
            style={{
              minHeight: `${MIN_HEIGHT}px`,
              maxHeight: `${MAX_HEIGHT}px`,
              opacity: isDragging ? 0.5 : 1
            }}
            onChange={(e) => {
              // adjustHeight();
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
    </div>
  );
}
