import React from "react";
import { useState, useRef, useEffect } from "react";
import RetryButton from "./RetryButton";
import EditButton from "./EditButton";
import EditBox from "./EditBox";
import MessageTextContainer from "./MessageTextContainer";
import Attachment from "../../Prompt/Attachment"
import CopyButton from "../MessageAssistant/CopyButton";

export default React.memo(({
    localState,
    setLocalState,
    message_index,
}) => {
    
    //Refs
    const userMessage = useRef(null);
    const [editMode, setEditMode] = useState(false);
    const message = localState.messages[message_index];

    // Detect outside clicks
    useEffect(() => {
        function handleClickOutside(event) {
        if (userMessage.current && !userMessage.current.contains(event.target)) {
            setEditMode(false); // Exit edit mode
        }
        }
        // Listen for clicks anywhere in document
        document.addEventListener("dblclick", handleClickOutside);
        // Cleanup when component unmounts
        return () => {
        document.removeEventListener("dblclick", handleClickOutside);
        };
    }, [setEditMode]);

    return (
        <div
            ref={userMessage}
            key={message_index}
            className={`flex flex-col items-end max-w-full group pt-2`}
            >
            {/* Message content */}
            {!editMode && (
                <div className="flex flex-row w-fit p-2.5 gap-1.5 text-black dark:text-white overflow-y-auto border border-gray-200 rounded-xl bg-bg_chat dark:bg-bg_chat_dark dark:border-gray-800 items-start">
                    {/* Display message text */}
                    <MessageTextContainer message={message} />
                </div>
            )}
            {/* Edit mode */}
            {editMode && ( 
                <EditBox
                    localState={localState}
                    setLocalState={setLocalState}
                    message_index={message_index}
                    setEditMode={setEditMode}
                />
            )}
        {/* Attachments Section */}
       {Array.isArray(message.content) && message.content.length > 1 && (
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
         {/* Buttons area */}
            {!editMode && (
                <div className="flex flex-row pt-2 w-fit opacity-25 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 gap-2.5 items-center justify-end ml-auto">
                    {/* Retry button */}
                    <RetryButton
                        localState={localState}
                        setLocalState={setLocalState}
                        message_index={message_index}
                    />
                    {/* Edit button */}
                    <EditButton
                        setEditMode={setEditMode}
                    />
                    <CopyButton
                        message={message}
                    />
                </div>
            )}
        </div>
    )
});