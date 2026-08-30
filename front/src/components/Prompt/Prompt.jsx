import { useState, useEffect} from "react";

import AbortButton from "./AbortButton";
import SendButton from "./SendButton";
import MicButton from "./MicButton";
import AttachmentsContainer from "./AttachmentsContainer";
import SettingsButton from "../Header/SettingsButton";
import WarningExternalModel from "../Header/WarningExternalModel";
import ModelButton from "./ModelButton";
import ToolsButton from "./ToolsButton";
import AttachButton from "./AttachButton";
import AttachMediaButton from "./AttachMediaButton";
import PromptTextArea from "./PromptTextArea";

import { useSendMessage } from "../../hooks/useSendMessage";
import { useDebounce } from "../../hooks/useDebounce";
import UndoButton from "../Conversation/UndoButton";

export default function Prompt({
  localState,
  setLocalState,
  userData,
  modelsData,
}) {
  const sendMessage = useSendMessage();
  const [shouldSend, setShouldSend] = useState(false);
  const [ignoreChanges, setIgnoreChanges] = useState(false);
  const lastMessage = localState.messages[localState.messages.length - 1];
  if (lastMessage?.content == undefined){
    // return to a valid conversation
    localState.messages = [{"content" : [{"text" : ""}]}];
  }
  const [prompt, setPrompt] = useState(lastMessage?.content[0]?.text || "");

  //const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";
  const attachments = lastMessage.content.slice(1);
  
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
    } else if (ignoreChanges) {
      setIgnoreChanges(false); // Ignored once
    } else {
      setPrompt(
        lastMessage?.content[0]?.text || ""
      );
    }
  }, [localState.messages]);

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
  
  return (
    <div className="prompt-area overflow-x-hidden w-full flex flex-shrink-0 flex-col 
    bg-white dark:bg-bg_secondary_dark dark:text-white text-black mobile:h-fit justify-center 
    sm:overflow-y-auto rounded-2xl shadow-bottom dark:shadow-darkBottom
    md:max-w-[85vw] xl:max-w-[1300px] transition-[max-width] duration-300 ease-in-out motion-reduce:transition-none mx-auto">
        {/* Attachments Container */}
        <AttachmentsContainer
          localState={localState}
          setLocalState={setLocalState}
        />
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
        <div className="px-3 py-2 w-full h-fit grid grid-cols-[1fr_auto_1fr] items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl relative">
          {/* Buttons on the left */}
          <div className="flex gap-4 items-center justify-start">
            {/* Attach Button */}
            <AttachButton
              localState={localState}
              setLocalState={setLocalState}
            />
               {/* Mic Button */}
            <MicButton
              localState={localState}
              setLocalState={setLocalState}
            />
            
          </div>
          {/* Buttons in the center */}
          <div className="flex gap-4 items-center justify-center">
            
            {/* Tools Button */}
            <ToolsButton
              localState={localState}
              setLocalState={setLocalState}
            />
            {/* Settings Button */}
            <SettingsButton
              localState={localState}
              setLocalState={setLocalState}
              userData={userData}
              modelsData={modelsData}
            />
            {/* Model Selector — the header keeps its own on narrow screens.
                It shrinks first, so Abort/Send never lose their place. */}
            <div className="hidden md:flex min-w-0">
              <ModelButton
                localState={localState}
                setLocalState={setLocalState}
                modelsData={modelsData}
              />
            </div>
            {/* Data safety indicator */}
            <div className="hidden md:flex">
              <WarningExternalModel
                localState={localState}
                userData={userData}
                portalPanel
                compact
              />
            </div>
          </div>
          {/* Buttons on the right */}
          <div className="flex gap-4 items-center justify-end min-w-0">
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
      </div>
      </div>
  );
}
