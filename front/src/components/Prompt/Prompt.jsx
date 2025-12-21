import { useState, useEffect} from "react";

import AbortButton from "./AbortButton";
import SendButton from "./SendButton";
import MicButton from "./MicButton";
import AttachmentsContainer from "./AttachmentsContainer";
import SettingsButton from "../Header/SettingsButton";
import AttachButton from "./AttachButton";
import AttachMediaButton from "./AttachMediaButton";
import ClearButton from "./ClearButton";
import PromptTextArea from "./PromptTextArea";

import { useSendMessage } from "../../hooks/useSendMessage";
import { useDebounce } from "../../hooks/useDebounce";

export default function Prompt({
  localState,
  setLocalState,
}) { 
  const sendMessage = useSendMessage();
  const [shouldSend, setShouldSend] = useState(false);
  const [ignoreChanges, setIgnoreChanges] = useState(false);
  const [prompt, setPrompt] = useState(localState.messages[localState.messages.length - 1].content[0]?.text || "");

  //const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";
  const attachments = localState.messages[localState.messages.length - 1].content.slice(1);

  // Update partial local state while preserving other values
  const savePrompt = () => {
    setIgnoreChanges(true);
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
        localState.messages[localState.messages.length - 1]?.content[0]?.text || ""
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
  const handleSend = async (event) => {
      event.preventDefault();
      if (prompt?.trim() === "" && attachments.length === 0) return;
      debouncedSave.cancel();
      savePrompt();
      setShouldSend(true);
  };
  
  return (
    <div className="prompt-area overflow-x-hidden w-full flex flex-shrink-0 flex-col bg-white dark:bg-bg_secondary_dark dark:text-white text-black mobile:h-fit justify-center sm:overflow-y-auto rounded-2xl shadow-bottom dark:shadow-darkBottom">
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
            setPrompt={setPrompt}
          />
          {/* Buttons Section */}
          <div className="px-3 py-2 w-full h-fit flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl relative">
            {/* Clear Button on the left  */}
            <ClearButton
              localState={localState}
              setLocalState={setLocalState}
            />
            {/* Buttons on the right */}
            <div className="flex gap-4 w-full justify-end items-center">
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
        </div>
      </div>
  );
}