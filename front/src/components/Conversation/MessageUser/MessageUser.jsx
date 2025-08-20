import React from "react";
import { useState } from "react";
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
    const [editMode, setEditMode] = useState(false);
    const message = localState.messages[message_index];

    return (
        <div key={message_index}
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
        {/* File rendering */}
       {Array.isArray(message.content) && message.content.length > 1 && (
            message.content.slice(1).map((attachment, i) => (
                <Attachment
                    localState={localState}
                    setLocalState={setLocalState}
                    attachment={attachment}
                    index={i}
                    inHistory={true}
                />
            ))
        )}
        </div>
    )
});