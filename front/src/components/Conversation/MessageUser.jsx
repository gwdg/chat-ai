import React from "react";
import icon_retry from "../../assets/icons/retry.svg";
import icon_edit from "../../assets/icons/edit.svg";
import icon_cross_sm from "../../assets/icons/cross_sm.svg";
import icon_send from "../../assets/icons/send.svg";
import { useState, useEffect, useCallback, useRef} from "react";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default React.memo(({
    localState,
    msg, 
    index, 
    containerRefs, 
    loading, 
    loadingResend
}) => {
    
    //Refs
    const textareaRef = useRef(null);
    const textareaRefs = useRef([]);
    //Functions
    const adjustHeight = () => {
        if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;

        const scrollHeight = textareaRef.current.scrollHeight;
        const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

        textareaRef.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
        }
    };

    const [editingIndex, setEditingIndex] = useState(null);
    const [editedText, setEditedText] = useState("");
    // Function to adjust textarea height for specific index
    const adjustHeightRefs = (index) => {
        if (textareaRefs.current[index]) {
        const textarea = textareaRefs.current[index];
        textarea.style.height = `${MIN_HEIGHT}px`;
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
        textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
        }
    };

     // Function to handle resending a previous message
    const handleRetryClick = async (index) => {
        await sendMessage({
        localState,
        setLocalState,
        openModal,
        operationType: "resend",
        index,
        dispatch,
        setLoadingResend,
        modelsData,
        memories,
        timeoutTime,
        });
    };

    // Function to handle closing edit mode
    const handleEditClose = useCallback(
        (index) => {
        if (editingIndex === index) {
            setEditingIndex(null);
        }
        },
        [editingIndex]
    );

    useEffect(() => {
        if (editingIndex !== null) {
          // Use requestAnimationFrame for smoother height adjustments
          requestAnimationFrame(() => adjustHeightRefs(editingIndex));
        }
      }, [editedText, editingIndex]);

    useEffect(() => {
        // Use requestAnimationFrame for smoother height adjustments
        requestAnimationFrame(() => adjustHeight());
    }, [editedText, adjustHeight]);
    
    // Function to handle editing message at specific index
    const handleEditClick = (index, prompt) => {
        setEditingResponseIndex(-1);
        setEditedText(prompt);
        setEditingIndex(index);
        // Focus after state updates
        setTimeout(() => {
            if (textareaRefs.current[index]) {
            const textarea = textareaRefs.current[index];
            textarea.focus();
            textarea.selectionStart = prompt.length;
            textarea.selectionEnd = prompt.length;
            }
        }, 0);
    };

    //Functions
    const handleResponseEdit = (index, response) => {
        setEditingIndex(-1);
        setEditedResponse(response);
        setEditingResponseIndex(index);
    };

      // Function to handle saving edited messages
    const handleSave = async (index) => {
        await sendMessage({
        localState,
        setLocalState,
        openModal,
        operationType: "edit",
        index,
        editedText, // Make sure this variable is available in your component scope
        dispatch,
        setLoadingResend,
        modelsData,
        memories,
        updateMemory,
        timeoutTime,
        });
    };

    return (
        <div key={index} className="flex flex-col gap-1">
        {msg.content[0]?.data?.trim() ? (
            <div
            ref={(el) => (containerRefs.current[index] = el)}
            className={`text-black dark:text-white overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl bg-bg_chat_user dark:bg-bg_chat_user_dark ${
                editingIndex === index ? "p-0" : "p-2.5"
            } flex flex-col gap-1.5`}
            >
            {/* Edit mode rendering */}
            {editingIndex === index && (
                <div className="justify-between items-start text-black dark:text-white overflow-y-auto border dark:border-border_dark rounded-xl bg-bg_chat_user dark:bg-bg_chat_user_dark p-2.5 flex flex-col gap-1.5">
                <textarea
                    ref={(el) => (textareaRefs.current[index] = el)}
                    className="p-1.5 outline-none text-sm rounded-xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-none overflow-y-auto"
                    value={editedText}
                    style={{
                    minHeight: `${MIN_HEIGHT}px`,
                    maxHeight: `${MAX_HEIGHT}px`,
                    }}
                    onChange={(e) => {
                    setEditedText(e.target.value);
                    adjustHeight(index);
                    }}
                    onKeyDown={(event) => {
                    if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        editedText?.trim() !== ""
                    ) {
                        event.preventDefault();
                        handleEditClose(index);
                        handleSave(index);
                        setIsEditing(false);
                    }
                    }}
                />
                <div className="flex gap-1.5 justify-between w-full">
                    <button
                    onClick={() => setEditedText("")}
                    disabled={loading || loadingResend}
                    >
                    <img
                        src={icon_cross_sm}
                        alt="clear"
                        className="h-[22px] w-[22px] cursor-pointer"
                    />
                    </button>
                    <button
                    onClick={() => {
                        handleEditClose(index);
                        handleSave(index);
                    }}
                    disabled={loading || loadingResend}
                    >
                    <img
                        className="cursor-pointer h-[22px] w-[22px]"
                        src={icon_send}
                        alt="send"
                    />
                    </button>
                </div>
                </div>
            )}
            {/* Non-edit mode rendering */}
            {editingIndex !== index && (
                <div className="flex gap-1.5 justify-between items-start group">
                {(
                    <>
                    <pre
                        className="font-sans flex-grow min-w-0 text-sm"
                        style={{
                        overflow: "hidden",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        }}
                    >
                        {msg.content[0].data}
                    </pre>
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-1.5 items-center">
                        <button
                        onClick={(e) => handleRetryClick(index, e)}
                        disabled={loading || loadingResend}
                        >
                        <img
                            src={icon_retry}
                            alt="icon_retry"
                            className="h-[22px] w-[22px] cursor-pointer"
                        />
                        </button>
                        <button
                        onClick={() => {
                            handleEditClick(index, msg.content[0].data);
                        }}
                        disabled={loading || loadingResend}
                        >
                        <img
                            src={icon_edit}
                            alt="edit_icon"
                            className="h-[22px] w-[22px] cursor-pointer"
                        />
                        </button>
                    </div>
                    </>
                )}
                </div>
            )}
            </div>
        ) : null}
        {/* File rendering */}
        {/* <MessageContainer
            localState={localState}
            msg={msg}
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