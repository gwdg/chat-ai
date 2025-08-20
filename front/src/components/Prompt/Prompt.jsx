import AbortButton from "./AbortButton";
import SendButton from "./SendButton";
import MicButton from "./MicButton";
import AttachmentsContainer from "./AttachmentsContainer";
import SettingsButton from "./SettingsButton";
import AttachButton from "./AttachButton";
import AttachMediaButton from "./AttachMediaButton";
import ClearButton from "./ClearButton";
import PromptTextArea from "./PromptTextArea";

import { useSendMessage } from "../../hooks/useSendMessage";

export default function Prompt({
  localState,
  setLocalState,
}) { 
  const sendMessage = useSendMessage();
  const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";

  // Handle form submission with prompt and files
  const handleSend = async (event) => {
      event.preventDefault();
      if (prompt?.trim() === "" && attachments.length === 0) return;

      // TODO update
      const hasUnprocessedDocument = false // attachments.some(
      // (file) =>
      //     (file.fileType === "pdf" ||
      //     file.fileType === "excel" ||
      //     file.fileType === "docx") &&
      //     !file.processed
      // );

      if (hasUnprocessedDocument) {
          openModal("unprocessedFiles");
          return;
      }

      await sendMessage({
          localState,
          setLocalState,
      });
  };
  
  return (
    <div className="w-full flex flex-shrink-0 flex-col bg-white dark:bg-bg_secondary_dark dark:text-white text-black mobile:h-fit justify-between sm:overflow-y-auto  rounded-2xl shadow-bottom dark:shadow-darkBottom">
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
              <SettingsButton />
              {/* Attach Button */}
              <AttachButton
                localState={localState}
                setLocalState={setLocalState}
              />
              {/* Attach Media Button */}
              <AttachMediaButton
                localState={localState}
                setLocalState={setLocalState}
              />
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
              />
            </div>
          </div>
        </div>
      </div>
  );
}