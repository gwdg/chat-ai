
import { useEffect, useRef, useState } from "react";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { setLockConversation } from "../../Redux/reducers/conversationsSlice";

import { useToast } from "../../hooks/useToast";

import { useAttachments } from "../../hooks/useAttachments";

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default function PromptTextArea({
    localState,
    setLocalState,
    handleSend
}) {
  const { t, i18n } = useTranslation();
  const textareaRef = useRef(null);
  const { notifySuccess, notifyError } = useToast();
  const { addAttachments, pasteAttachments } = useAttachments();
  const model = localState.settings.model;
  const isAudioSupported = (model?.input?.includes("audio") || false)
  const isVideoSupported = (model?.input?.includes("video") || false)
  const isImageSupported = (model?.input?.includes("image") || false)

  // Prompt is actually the last message's first content
  const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";
  const attachments = localState.messages[localState.messages.length - 1].content.slice(1);
  // Update partial local state while preserving other values
  const setPrompt = (prompt) => {
    setLocalState((prev) => {
      const messages = [...prev.messages]; // shallow copy
      messages[messages.length - 1] = {
        role: "user",
        content: [ { // Replace first content item
            type: "text",
            text: prompt
          }, // Keep other content items
          ...prev.messages[messages.length - 1].content.slice(1)
        ]
      };
      return { ...prev, messages };
    });
  };

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "56px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  };

  // Handle file drop events for images and videos
  const handleDrop = async (e) => {
    if (!isImageSupported && !isVideoSupported && !isAudioSupported) return;
    e.preventDefault();
    addAttachments({
      localState,
      setLocalState,
      selectedFiles: Array.from(e.dataTransfer.files),
    });
  };

  // Handle changes in the prompt textarea
  const handleChange = (event) => {
    setPrompt(event.target.value);
    adjustHeight();
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
    className="drag-drop-container"
    onDragOver={(e) => e.preventDefault()}
    onDrop={handleDrop}
    >
    <textarea
        autoFocus
        ref={textareaRef}
        className="p-5 outline-none text-base rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto"
        value={prompt}
        name="prompt"
        placeholder={t("description.placeholder")}
        style={{
        minHeight: `${MIN_HEIGHT}px`,
        maxHeight: `${MAX_HEIGHT}px`,
        }}
        onChange={handleChange}
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
        onPaste={
        isImageSupported || isVideoSupported ? handlePaste : null
        }
    />
    </div>
  );
}