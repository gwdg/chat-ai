import React from "react";
import { useState, useRef, useEffect } from "react";
import RetryButton from "./RetryButton";
import EditButton from "./EditButton";
import EditBox from "./EditBox";
import MessageTextContainer from "./MessageTextContainer";
import Attachment from "../../Prompt/Attachment"

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
            className={`flex flex-col gap-1.5 text-black dark:text-white overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl bg-bg_chat_user dark:bg-bg_chat_user_dark
                ${ editMode ? "p-0" : "p-2.5"}`}
            >
            {/* Non-edit mode */}
            {!editMode && (
                <div className="flex gap-1.5 justify-between items-start group">
                    {/* Display message text */}
                    <MessageTextContainer message={message} />
                    {/* Buttons area */}
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-1.5 items-center">
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
                    </div>
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
        </div>
    )
});