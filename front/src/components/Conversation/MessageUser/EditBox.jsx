import { useRef } from "react";

import { X, Send } from "lucide-react";

import { useSendMessage } from "../../../hooks/useSendMessage";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default function EditBox({
  localState,
  setLocalState,
  message_index,
  setEditMode,
}) {
  const message = localState.messages[message_index];
  const sendMessage = useSendMessage();

  const editBox = useRef(null);

  // Function to handle saving edited message
  const handleSave = (doSplice = false) => {
    setLocalState((prevState) => {
      let newMessages;
      if (doSplice) {
        // Take a copy of messages only up to message_index + 1
        newMessages = prevState.messages.slice(0, message_index + 1);
      } else {
        // Create a shallow copy without cutting off elements
        newMessages = [...prevState.messages];
      }
      newMessages[message_index].content[0].data = editBox.current.value;
      return { ...prevState, messages: newMessages };
    });
    setEditMode(false);
  };

  // Function to handle sending a message
  const handleSend = async () => {
    handleSave(true);
    await sendMessage({
      localState,
      setLocalState,
    });
  };

  return (
    <div className="justify-between items-start text-black dark:text-white overflow-y-auto border dark:border-border_dark rounded-xl bg-bg_chat_user dark:bg-bg_chat_user_dark p-2.5 flex flex-col gap-1.5">
      <textarea
        ref={editBox}
        className="p-1.5 outline-none text-sm rounded-xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-none overflow-y-auto"
        defaultValue={message.content[0].data}
        style={{
          minHeight: `${MIN_HEIGHT}px`,
          maxHeight: `${MAX_HEIGHT}px`,
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            editBox.current.value?.trim() !== ""
          ) {
            event.preventDefault();
            handleSave();
          }
        }}
      />
      <div className="flex gap-1.5 justify-between w-full">
        {/* Clear edit box button */}
        <button
          className="cursor-pointer"
          onClick={() => {
            editBox.current.value = "";
          }}
        >
          {" "}
          <X
            className="h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
            alt="clear"
          />
        </button>
        {/* Submit edited message button */}
        <button
          className="cursor-pointer"
          onClick={() => {
            setEditMode(false);
            handleSend();
          }}
          // disabled={loading || loadingResend}
        >
          <Send
            className="cursor-pointer h-[22px] w-[22px] text-[#009EE0]"
            alt="send"
          />
        </button>
      </div>
    </div>
  );
}
