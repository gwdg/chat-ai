
import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "../../hooks/useToast";

import { useAttachments } from "../../hooks/useAttachments";

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;
const MOBILE_MAX_HEIGHT = 120;
const MOBILE_MIN_HEIGHT = 44;

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
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 800px)").matches
  );
  const { notifySuccess, notifyError } = useToast();
  const { addAttachments, pasteAttachments } = useAttachments();
  
  // Prompt is actually the last message's first content
  const lastMessage = localState?.messages?.[localState.messages.length - 1];
  const attachments = Array.isArray(lastMessage?.content)
    ? lastMessage.content.slice(1)
    : [];
  const choices = Array.isArray(localState?.choices) ? localState.choices : [];

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 800px)");
    const onMediaChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onMediaChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(onMediaChange);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", onMediaChange);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(onMediaChange);
      }
    };
  }, []);

  const minHeight = isMobileViewport ? MOBILE_MIN_HEIGHT : MIN_HEIGHT;
  const maxHeight = isMobileViewport ? MOBILE_MAX_HEIGHT : MAX_HEIGHT;

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = `${minHeight}px`;
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [maxHeight, minHeight]);

  useEffect(() => {
    requestAnimationFrame(() => adjustHeight());
  }, [prompt, adjustHeight, isMobileViewport]);

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
      <textarea
          autoFocus
          ref={textareaRef}
          rows={1}
          className={`p-5 mobile:px-3 mobile:py-2.5 mobile:pr-36 mobile:pb-10 mobile:text-[15px] transition-opacity duration-300 ease-in-out outline-none text-base w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto ${
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
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
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
