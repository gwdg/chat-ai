import React from "react";
import { useState } from "react";
import RetryButton from "./RetryButton";
import EditButton from "./EditButton";
import EditBox from "./EditBox";
import MessageTextContainer from "./MessageTextContainer";

export default React.memo(({
    localState,
    setLocalState,
    message_index,
}) => {
    
    //Refs
    const [editMode, setEditMode] = useState(false);
    const message = localState.messages[message_index];

    return (
        <div key={message_index} className="flex flex-col gap-1">
            <div
            className={`text-black dark:text-white overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl bg-bg_chat_user dark:bg-bg_chat_user_dark ${
                editMode ? "p-0" : "p-2.5"
            } flex flex-col gap-1.5`}
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
            </div>
        {/* File rendering */}
        {/* <MessageContainer
            localState={localState}
            message={message}
            index={index}
            copied={copied}
            setCopied={setCopied}
            indexChecked={indexChecked}
            setIndexChecked={setIndexChecked}
            loading={loading}
            loadingResend={loadingResend}
            editingResponseIndex={editingResponseIndex}
            setEditedResponse={setEditedResponse}
            handleResponseEdit={handleResponseEdit}
            editedResponse={editedResponse}
            setEditingResponseIndex={setEditingResponseIndex}
            handleResendClick={handleRetryClick}
        /> */}
        </div>
    )
});