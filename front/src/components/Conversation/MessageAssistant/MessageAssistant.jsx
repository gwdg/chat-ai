import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import Typing from "./Typing";
import CopyButton from "./CopyButton";
import Attachment from "../../Prompt/Attachment";
import EditButton from "./EditButton";
import { RotateCw, GitFork } from "lucide-react";
import { useSendMessage } from "../../../hooks/useSendMessage";
import MetaBox from "./MetaBox";
import { useNavigate } from "react-router";
import { createConversation, newId, saveFile, loadFile, saveStructuredToolData } from "../../../db";
import { useToast } from "../../../hooks/useToast";
import FeedbackButtons from "./FeedbackButtons";
import ForkButton from "./ForkButton";
import StructuredToolResponse from "../../StructuredToolResponses/StructuredToolResponse";
import { validateStructuredResponse } from "../../../utils/structuredToolValidation";
import { setActiveResponse } from "../../../Redux/reducers/structuredToolResponsesSlice";
import { useDispatch } from "react-redux";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

// Helper function to detect structured tool responses (defined outside component)
const isStructuredToolResponse = (content) => {
  if (!content || typeof content !== 'string') return null;
  
  try {
    // Check if it's a markdown code block with structured_form
    const structuredFormRegex = /```structured_form\s*([\s\S]*?)\s*```/;
    const match = content.match(structuredFormRegex);
    
    if (match) {
      // Parse the JSON inside the code block
      const formConfig = JSON.parse(match[1]);
      
      // Transform the structured_form format to structured_tool_response format
      return {
        type: 'structured_tool_response',
        version: '1.0',
        tool_id: 'structured_form',
        status: 'in_progress',
        data: {
          schema: {
            title: formConfig.title || '',
            description: formConfig.description || '',
            fields: formConfig.fields || [],
            submit_text: formConfig.submit_text || 'Submit',
            cancel_text: formConfig.cancel_text || 'Cancel',
            layout: formConfig.layout || 'vertical'
          },
          values: formConfig.values || {},
          metadata: {}
        }
      };
    }
    
    // Legacy format: direct structured_tool_response JSON
    const parsed = JSON.parse(content);
    if (parsed.type === 'structured_tool_response' && 
        validateStructuredResponse(parsed).valid) {
      return parsed;
    }
    
    return null;
  } catch {
    return null;
  }
};

export default React.memo(({ localState, setLocalState, message_index }) => {
  const dispatch = useDispatch();
  //Refs
  const assistantMessage = useRef(null);
  const editBox = useRef(null);
  const feedbackBox = useRef(null);
  const textareaRefs = useRef([]);
  const message = localState.messages[message_index];
  const loading = message?.loading || false;
  const [renderMode, setRenderMode] = useState("Default");
  const structuredResponse = useMemo(() => {
    if (!message?.content?.[0]?.text) return null;
    return isStructuredToolResponse(message.content[0].text);
  }, [message?.content?.[0]?.text]);
  // Define render modes with better styling
  const renderModes = ["Default", "Markdown", "LaTeX", "Plaintext"];
  
  const sendMessage = useSendMessage();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();
const [forking, setForking] = useState(false);
  const feedbackModule = import.meta.env.VITE_MODULE_FEEDBACK === "true";
  
  const handleStructuredResponseSubmit = async (updatedResponse) => {
    const responseId = `${message_index}-${Date.now()}`;
    
    dispatch(setActiveResponse({
      id: responseId,
      response: updatedResponse
    }));
    
    const mcpToolCall = {
      id: `call_${Date.now()}`,
      type: "function",
      function: {
        name: updatedResponse.tool_id,
        arguments: JSON.stringify(updatedResponse.data.values)
      }
    };

    // Update the message with locked state
    if (structuredResponse) {
      // For markdown format, keep the original markdown but update a marker
      setLocalState((prev) => {
        const newMessages = [...prev.messages];
        // Don't modify the markdown content, just set loading state
        newMessages[message_index].loading = true;
        return { 
          ...prev, 
          messages: newMessages,
          flush: true
        };
      });
    } else {
      // Legacy format: update JSON content
      const updatedResponseWithLock = {
        ...updatedResponse,
        locked: true
      };
      setLocalState((prev) => {
        const newMessages = [...prev.messages];
        newMessages[message_index].content[0].text = JSON.stringify(updatedResponseWithLock);
        newMessages[message_index].loading = true;
        return { 
          ...prev, 
          messages: newMessages,
          flush: true
        };
      });
    }

    await sendMessage({ 
      mcpToolCall: mcpToolCall,
      localState: localState,
      setLocalState,
      expectingToolResponse: true
    });
  };

  const handleStructuredResponseChange = (field, value) => {
    // Don't update message content for new markdown format
    // The form values are persisted to IndexedDB separately
    if (structuredResponse) {
      // For markdown format, we don't update the message content
      // Values are stored in IndexedDB via StructuredToolResponse component
      return;
    }
    
    // Legacy format: update message content
    const response = JSON.parse(message?.content[0]?.text || '{}');
    if (response.data && response.data.values) {
      response.data.values[field] = value;
      
      setLocalState((prev) => {
        const newMessages = [...prev.messages];
        newMessages[message_index].content[0].text = JSON.stringify(response);
        return { 
          ...prev, 
          messages: newMessages
        };
      });
    }
  };

  const handleStructuredResponseCancel = () => {
    console.log('Structured response cancelled by user');
  };
  
  const handleStructuredResponseEdit = (unlockedResponse) => {
    // For markdown format, lock/unlock doesn't apply
    // The form has its own edit mode
    if (structuredResponse) return;
    
    setLocalState((prev) => {
      const newMessages = [...prev.messages];
      newMessages[message_index].content[0].text = JSON.stringify(unlockedResponse);
      return { 
        ...prev, 
        messages: newMessages,
        flush: true
      };
    });
  };

  //Functions
  const adjustHeight = () => {
    if (editBox.current) {
      editBox.current.style.height = `${MIN_HEIGHT}px`;

      const scrollHeight = editBox.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

      editBox.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };
  
  const sendFeedbackFunc = async (ratingInt, commentStr, expectedStr) => {
    // Remove messages after current index
    let newState;
    setLocalState((prev) => {
      const newMessages = [...prev.messages];
      const newMessagesWithFB = [...prev.messages];
      newMessages.splice(message_index + 1);

      newMessages[newMessages.length-1].feedback = {
        rating : ratingInt,
        comment: commentStr,
        result : expectedStr
      };
      console.log("sending feedback");
      console.log(newMessages[newMessages.length-1].feedback);

      newMessagesWithFB[newMessages.length-1].feedback = newMessages[newMessages.length-1].feedback;
      newState = { ...prev, messages: newMessages }
      sendMessage({localState: newState});
      return { ...prev, messages: newMessagesWithFB };
    });
  };

  const [feedbackMode, setFeedbackMode] = useState(false);  
  const [feedbackText, setFeedbackText] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState("");
  let submitFeedbackCallback;
  const injectFeedbackCallback = (cb) =>{
    submitFeedbackCallback = cb;
  };
  // Function to adjust textarea height for specific index
  const adjustHeightRefs = () => {
    // if (textareaRefs.current[index]) {
    //   const textarea = textareaRefs.current[index];
    //   textarea.style.height = `${MIN_HEIGHT}px`;
    //   const scrollHeight = textarea.scrollHeight;
    //   const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
    //   textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    // }
  };

  // Detect outside double clicks
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        assistantMessage.current &&
        !assistantMessage.current.contains(event.target)
      )
        setEditMode(false); // Exit edit mode
        setFeedbackMode(false);
    }
    document.addEventListener("dblclick", handleClickOutside);
    return () => {
      document.removeEventListener("dblclick", handleClickOutside);
    };
  }, [setEditMode]);

  useEffect(() => {
    const text = Array.isArray(message?.content) && message.content[0]?.text ? message.content[0].text : "";
    setEditedText(text);
  }, [editMode, message]);

  useEffect(() => {
    setFeedbackText(message?.feedback?.comment || "");
  }, [feedbackMode]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeightRefs());
  }, [editedText]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeight());
  }, [editedText, adjustHeight]);

  // Function to handle saving edited message
  const handleSave = () => {
    setLocalState((prev) => {
      let newMessages = [...prev.messages];
      newMessages[message_index].content[0].text = editedText;
      return { ...prev, messages: newMessages, flush: true };
    });
    setEditMode(false);
  };

  // Function to handle saving edited message
  const handleSaveFB = () => {    
    const msg = localState.messages[message_index];
    setFeedbackMode(false);    
    sendFeedbackFunc(msg.feedback?.rating, feedbackText, msg?.feedback?.result);
  };

  // Function to handle resending a previous message
  const handleRetry = async () => {
    // Remove messages after current index

    setLocalState((prev) => {
      const newMessages = [...prev.messages];
      newMessages.splice(message_index);
      let newState = { ...prev, messages: newMessages };
      sendMessage({ localState: newState, setLocalState });
      return { ...prev, messages: newMessages };
    });
  };

  const cloneMessageContent = useCallback(
    async (content, targetConversationId) => {
      const items = Array.isArray(content)
        ? content
        : typeof content === "string"
          ? [{ type: "text", text: content }]
          : [];
      const clonedContent = [];
      for (const item of items) {
        if (item?.type === "file" && item?.fileId) {
          try {
            const file = await loadFile(item.fileId);
            if (file) {
              const newFileId = saveFile(targetConversationId, file);
              clonedContent.push({ type: "file", fileId: newFileId });
            }
          } catch (error) {
            console.warn("Failed to clone attachment", error);
          }
          continue;
        }
        if (item?.type) {
          clonedContent.push({ ...item });
        } else if (item?.text) {
          clonedContent.push({ type: "text", text: item.text });
        } else {
          clonedContent.push({ type: "text", text: "" });
        }
      }
      if (clonedContent.length === 0) {
        return [{ type: "text", text: "" }];
      }
      return clonedContent;
    },
    []
  );

  const handleForkConversation = useCallback(async () => {
    if (forking) return;
    try {
      setForking(true);
      const sourceMessages = localState?.messages?.slice(0, message_index + 1) || [];
      if (sourceMessages.length === 0) {
        notifyError("Keine Nachrichten zum Forken gefunden.");
        return;
      }

      const newConversationId = newId();
      const forkMessages = [];
      for (const msg of sourceMessages) {
        if (!msg?.role) continue;
        const clonedContent = await cloneMessageContent(msg.content, newConversationId);
        forkMessages.push({
          role: msg.role,
          content: clonedContent,
          meta: msg.meta,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        });
      }

      if (forkMessages[forkMessages.length - 1]?.role !== "user") {
        forkMessages.push({
          role: "user",
          content: [{ type: "text", text: "" }],
        });
      }

      const baseTitle = localState?.title?.trim();
      const forkTitle = baseTitle
        ? baseTitle.endsWith(" (Fork)") ? baseTitle : `${baseTitle} (Fork)`
        : "Forked Conversation";

      const settingsClone = JSON.parse(JSON.stringify(localState?.settings || {}));

      await createConversation({
        id: newConversationId,
        title: forkTitle,
        settings: settingsClone,
        messages: forkMessages,
        folderId: localState?.folderId ?? null,
      });

      notifySuccess("Neue Konversation erstellt.");
      navigate(`/chat/${newConversationId}`);
    } catch (error) {
      console.error("Failed to fork conversation", error);
      notifyError("Konversation konnte nicht geforkt werden.");
    } finally {
      setForking(false);
    }
  }, [
    cloneMessageContent,
    forking,
    localState?.folderId,
    localState?.messages,
    localState?.settings,
    localState?.title,
    message_index,
    navigate,
    notifyError,
    notifySuccess,
  ]);

  const content = message?.content?.[0]?.text ?? "";
  const isContentEmpty = !content.trim();
  return (
    <div
      key={message_index}
      ref={assistantMessage}
      className={`text-black dark:text-white overflow-hidden border border-gray-200 dark:border-gray-800 
          rounded-2xl bg-bg_chat dark:bg-bg_chat_dark
          ${editMode ? "px-1 pt-1" : "px-3 pt-3"}
          ${
            isContentEmpty && !loading
              ? "bg-bg_chat/50 dark:bg-bg_chat_dark/50 pt-0"
              : " bg-bg_chat dark:bg-bg_chat_dark"
          }`}
    >
      {isContentEmpty ? (
        <div
          className={`flex flex-col
            ${loading ? "pb-4" : "pb-3"}`}
        >
          {loading && <Typing />}
          {!loading && (
            <div className="flex flex-col items-center justify-start gap-3 py-1">
              <button
                onClick={handleRetry}
                className="cursor-pointer flex items-center gap-2 px-4 py-3 text-sm opacity-100 text-black dark:text-white bg-red-500/40 rounded-full hover:bg-red-400/100 transition-all"
                disabled={loading}
              >
                <RotateCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Edit Mode */}
          {editMode && (
            <div className="flex flex-col justify-between gap-1">
              <textarea
                ref={editBox}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    editBox.current.value?.trim() !== ""
                  ) {
                    event.preventDefault();
                    handleSave();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setEditMode(false);
                  }
                }}
                className="p-2 outline-none rounded-sm w-full text-sm dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-y overflow-y-auto"
                placeholder="Edit response..."
                style={{
                  minHeight: `${MIN_HEIGHT}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                }}
              />
              <div className="flex gap-4 justify-end w-full gap-2 pt-1 pb-2 px-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave()}
                  className="text-md text-primary border dark:text-tertiary rounded-full px-3 py-1 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {feedbackMode && (
            <div className="flex flex-col justify-between gap-1">

              <div>WARNING: Your feedback will be sent to the server.</div>
              
              <textarea
                ref={feedbackBox}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    feedbackBox.current.value?.trim() !== ""
                  ) {
                    event.preventDefault();
                    handleSaveFB();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setFeedbackMode(false);
                  }
                }}
                className="p-2 outline-none rounded-sm w-full text-sm dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-y overflow-y-auto"
                placeholder="Provide feedback..."
                style={{
                  minHeight: `${MIN_HEIGHT}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                }}
              />
              <div className="flex gap-4 justify-end w-full gap-2 pt-1 pb-2 px-2">
                <button
                  onClick={() => setFeedbackMode(false)}
                  className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveFB()}
                  className="text-md text-primary border dark:text-tertiary rounded-full px-3 py-1 cursor-pointer"
                >
                  Save & Send FB
                </button>
              </div>
            </div>
          )}          
{/* Display message content */}
           {!editMode && !feedbackMode && (
             <div className="flex flex-col gap-4">
               {structuredResponse ? (
                 <StructuredToolResponse
                   response={{
                     id: `${message_index}`,
                     ...structuredResponse,
                     data: {
                       ...structuredResponse.data,
                       metadata: {
                         ...structuredResponse.data.metadata,
                         messageId: message.id
                       }
                     }
                   }}
                   messageIndex={message_index}
                   onChange={handleStructuredResponseChange}
                   onSubmit={handleStructuredResponseSubmit}
                   onCancel={handleStructuredResponseCancel}
                   onEdit={handleStructuredResponseEdit}
                 />
               ) : (
                 <MarkdownRenderer isLoading={loading} renderMode={renderMode}>
                   {message?.content?.[0]?.text || ""}
                 </MarkdownRenderer>
               )}
              {/* Attachments Section */}
              {Array.isArray(message?.content) && message?.content.length > 1 && (
                <div className="flex flex-wrap gap-2 pr-1 pb-1 max-h-24 sm:max-h-28 md:max-h-40 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
                  {message.content.slice(1).map((attachment, i) => (
                    <Attachment
                      key={i}
                      localState={localState}
                      setLocalState={setLocalState}
                      attachment={attachment}
                      index={i}
                      inHistory={true}
                      inAssistant={true}
                    />
                  ))}
                </div>
              )}
{/* Bottom panel for message */}
                <div className="group flex justify-between w-full mt-1 gap-2">
                  <div className="flex items-center justify-end mb-2 opacity-30 group-hover:opacity-100 transition-opacity duration-300">
                    {/* Render Mode Selector on the bottom left - only show for non-structured messages */}
                    {!structuredResponse && (
                      <div className="flex h-8 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden ">
                        {renderModes.map((mode) => (
                          <button
                            key={mode}
                            onClick={() => !loading && setRenderMode(mode)}
                            className={`px-2 py-1 text-xs font-medium transition-all duration-300 ease-in-out min-w-[60px] cursor-pointer select-none
                        ${loading ? "cursor-not-allowed opacity-20" : ""}
                        ${
                          renderMode === mode
                            ? "bg-tertiary text-white"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }
                        `}
                            disabled={loading}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                 {feedbackModule && (
                   <FeedbackButtons
                     localState={localState}
                     setLocalState={setLocalState}
                     message_index={message_index}
                     setFeedbackMode={setFeedbackMode} 
                     sendFeedbackFunc={sendFeedbackFunc}
                   />
                 )}
                 
{/* Buttons on the bottom right - show model/meta and fork/edit for all messages, hide copy for structured forms */}
                 <div className="flex items-center justify-end gap-3 overflow-hidden">
                   {/* Show message metadata (model name, etc.) for ALL messages */}
                   {message?.meta && (
                     <MetaBox meta={message.meta} />
                   )}
                   {/* Fork button is useful for forms too - allows branching conversation */}
                   <ForkButton handleForkConversation={handleForkConversation} />
                   {/* Edit button allows editing the message content/structure */}
                   <EditButton setEditMode={setEditMode} />
                   {/* Only show Copy for non-structured messages */}
                   {!structuredResponse && (
                     <CopyButton message={message} />
                   )}
                 </div>
               </div>
            </div>
          )}
        </>
      )}
      
    </div>
  );
});
