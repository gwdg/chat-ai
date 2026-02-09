import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import AbortButton from "./AbortButton";
import SendButton from "./SendButton";
import MicButton from "./MicButton";
import AttachmentsContainer from "./AttachmentsContainer";
import SettingsButton from "../Header/SettingsButton";
import AttachButton from "./AttachButton";
import AttachMediaButton from "./AttachMediaButton";
import ClearButton from "./ClearButton";
import PromptTextArea from "./PromptTextArea";
import SpeechModePanel from "./SpeechModePanel";

import { useSendMessage } from "../../hooks/useSendMessage";
import { useDebounce } from "../../hooks/useDebounce";
import { useAttachments } from "../../hooks/useAttachments";
import { AudioWaveform } from "lucide-react";

export default function Prompt({
  localState,
  setLocalState,
}) { 
  const { t } = useTranslation();
  const sendMessage = useSendMessage();
  const { addAudioAttachment } = useAttachments();
  const [shouldSend, setShouldSend] = useState(false);
  const [ignoreChanges, setIgnoreChanges] = useState(false);
  const [speechModeOpen, setSpeechModeOpen] = useState(false);
  const [speechPendingSend, setSpeechPendingSend] = useState(false);
  const [portalRoot, setPortalRoot] = useState(null);
  const previousAttachmentCountRef = useRef(0);
  const lastMessage = localState.messages[localState.messages.length - 1];
  if (lastMessage?.content == undefined){
    // return to a valid conversation
    localState.messages = [{"content" : [{"text" : ""}]}];
  }
  const [prompt, setPrompt] = useState(lastMessage?.content[0]?.text || "");

  //const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";
  const attachments = lastMessage.content.slice(1);
  const tools = localState?.settings?.tools || {};
  const speechEnabled = !!localState?.settings?.enable_tools && !!tools.audio_generation;
  
  // Update partial local state while preserving other values
  const savePrompt = (nextPrompt = prompt, { clearChoices = false } = {}) => {
    setIgnoreChanges(true);
    setLocalState((prev) => {
      const messages = [...prev.messages]; // shallow copy
      messages[messages.length - 1] = {
        role: "user",
        content: [ { // Replace first content item
            type: "text",
            text: nextPrompt
          }, // Keep other content items
          ...prev.messages[messages.length - 1].content.slice(1)
        ]
      };
      return {
        ...prev,
        messages,
        ...(clearChoices ? { choices: [] } : {}),
      };
    });
  };

  // Effect, watch for changes to prompt in localState
  useEffect(() => {
    if (shouldSend) {
      sendMessage({localState, setLocalState});
      setShouldSend(false);
      setIgnoreChanges(false);
      setPrompt("");
      setSpeechModeOpen(false);
    } else if (ignoreChanges) {
      setIgnoreChanges(false); // Ignored once
    } else {
      setPrompt(
        lastMessage?.content[0]?.text || ""
      );
    }
  }, [localState.messages]);

  useEffect(() => {
    if (!speechEnabled && speechModeOpen) {
      setSpeechModeOpen(false);
    }
  }, [speechEnabled, speechModeOpen]);

  useEffect(() => {
    if (!speechModeOpen) {
      setPortalRoot(null);
      return;
    }
    if (typeof document === "undefined") return;
    setPortalRoot(document.getElementById("conversation-shell"));
  }, [speechModeOpen]);

  useEffect(() => {
    if (!speechPendingSend) return;
    if (attachments.length <= previousAttachmentCountRef.current) return;
    const fakeEvent = { preventDefault: () => {} };
    handleSend(fakeEvent, "");
    previousAttachmentCountRef.current = attachments.length;
    setSpeechPendingSend(false);
  }, [speechPendingSend, attachments.length]);

  // Handle changes to the prompt
  const debouncedSave = useDebounce(savePrompt, 300);
  const handleChange = (e) => {
    setPrompt(e.target.value);
    debouncedSave();
  };
  
  // Handle form submission with prompt and files
  const handleSend = async (event, nextPrompt) => {
      event.preventDefault();
      const promptToSend = typeof nextPrompt === "string" ? nextPrompt : prompt;
      if (promptToSend?.trim() === "" && attachments.length === 0) return;
      debouncedSave.cancel();
      savePrompt(promptToSend, { clearChoices: true });
      setShouldSend(true);
  };

  const handleSpeechAudio = async ({ audioBlob, type }) => {
    previousAttachmentCountRef.current = attachments.length;
    const didAttach = await addAudioAttachment({
      localState,
      setLocalState,
      audioBlob,
      type,
    });
    if (!didAttach) {
      setSpeechPendingSend(false);
      return;
    }
    setSpeechPendingSend(true);
  };
  
  return (
    <div className="prompt-area overflow-x-hidden w-full flex flex-shrink-0 flex-col bg-white dark:bg-bg_secondary_dark dark:text-white text-black mobile:h-fit justify-center sm:overflow-y-auto rounded-2xl shadow-bottom dark:shadow-darkBottom">
        {speechModeOpen && portalRoot &&
          createPortal(
            <div className="absolute inset-0 z-50 bg-slate-950/70 dark:bg-black/70 backdrop-blur-sm">
              <SpeechModePanel
                onClose={() => setSpeechModeOpen(false)}
                onAudioCaptured={handleSpeechAudio}
                autoStart
              />
            </div>,
            portalRoot
          )
        }
        {/* Attachments Container */}
        {!speechModeOpen && (
          <AttachmentsContainer
            localState={localState}
            setLocalState={setLocalState}
          />
        )}
        <div className={`flex flex-col gap-4 w-full relative select-none rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark`} >
          {/* Prompt Text Area */}
          <PromptTextArea
            localState={localState}
            setLocalState={setLocalState}
            handleSend={handleSend}
            handleChange={handleChange}
            prompt={prompt}
          />
          {/* Buttons Section */}
          {!speechModeOpen && (
            <div className="px-3 py-2 w-full h-fit grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-white dark:bg-bg_secondary_dark rounded-b-2xl relative">
              {/* Clear Button on the left  */}
              <div className="flex items-center">
                <ClearButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
              </div>
              <div className="flex justify-center">
                {speechEnabled && (
                  <button
                    type="button"
                    onClick={() => setSpeechModeOpen(true)}
                    className="cursor-pointer h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-tertiary text-white text-xs sm:text-sm font-semibold shadow-lg hover:bg-[#008ac2] transition-all duration-200 flex items-center justify-center gap-2"
                    aria-label={t("conversation.speech_mode_button")}
                  >
                    <AudioWaveform className="h-4 w-4 sm:h-5 sm:w-5" />
                    {t("conversation.speech_mode_button")}
                  </button>
                )}
              </div>
              {/* Buttons on the right */}
              <div className="flex flex-wrap gap-3 justify-end items-center">
                {/* Settings Button */}
                {/* <SettingsButton /> */}
                {/* Attach Button */}
                <AttachButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
                {/* Attach Media Button */}
                {/* <AttachMediaButton
                  localState={localState}
                  setLocalState={setLocalState}
                /> */}
                {/* Mic Button */}
                <MicButton 
                  localState={localState}
                  setLocalState={setLocalState}
                />
                {/* Abort button (when loading) */}
                <AbortButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
                {/* If not loading, show send button */}
                <SendButton
                  localState={localState}
                  setLocalState={setLocalState}
                  handleSend={handleSend}
                  prompt={prompt}
                />
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
