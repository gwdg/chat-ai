import React, { useState, useEffect, useCallback, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import FeatureGuideCard from "../../Others/FeatureGuideCard";
import UseCaseGuideCard from "../../Others/UseCaseGuideCard";
import Typing from "./Typing";
import CopyButton from "./CopyButton";
import Attachment from "../../Prompt/Attachment";
import EditButton from "./EditButton";
import { RotateCw } from "lucide-react";
import { useSendMessage } from "../../../hooks/useSendMessage";
import { useForkConversation } from "../../../hooks/useForkConversation";
import { useModal } from "../../../modals/ModalContext";
import MetaBox from "./MetaBox";
import PersonaCard from "../../Others/PersonaCard";
import MetaActionCard from "./MetaActionCard";
import FeedbackButtons from "./FeedbackButtons";
import ForkButton from "./ForkButton";
import SpeakButton from "./SpeakButton";
import AgentSteps from "./AgentSteps";
import ToolForm from "./ToolForm";
import { getFeatureGuideMarker } from "../../../config/featureGuides";
import { getUseCaseMarker } from "../../../config/useCases";
import { getPersonaMarkers } from "../../../utils/personaCatalog";
import { getMetaActionProposals } from "../../../utils/metaActions";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default React.memo(({ localState, setLocalState, message_index, modelsData }) => {
  //Refs
  const assistantMessage = useRef(null);
  const editBox = useRef(null);
  const feedbackBox = useRef(null);
  const textareaRefs = useRef([]);
  const message = localState.messages[message_index];
  const loading = message?.loading || false;
  const guideFeatureId = loading
    ? null
    : getFeatureGuideMarker(message?.content?.[0]?.text);
  const guideUseCaseId = loading
    ? null
    : getUseCaseMarker(message?.content?.[0]?.text);
  const personaPaths = loading
    ? []
    : getPersonaMarkers(message?.content?.[0]?.text);
  const metaActions = loading
    ? []
    : getMetaActionProposals(message?.content?.[0]?.text);
  const [renderMode, setRenderMode] = useState("Default");
  // Define render modes with better styling
  const renderModes = ["Default", "Markdown", "Plaintext"];
  
  const sendMessage = useSendMessage();
  const { forkConversation } = useForkConversation(localState);
  const { confirmAction } = useModal();
  const feedbackModule = import.meta.env.VITE_MODULE_FEEDBACK === "true";

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
    const feedback = {
      rating: ratingInt,
      comment: commentStr,
      result: expectedStr,
    };
    const newMessagesWithFB = [...localState.messages];
    newMessagesWithFB[message_index] = {
      ...newMessagesWithFB[message_index],
      feedback,
    };

    const newState = {
      ...localState,
      messages: newMessagesWithFB.slice(0, message_index + 1),
    };

    setLocalState({ ...localState, messages: newMessagesWithFB });
    sendMessage({ localState: newState });
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
    setEditedText(message?.content[0]?.text || "");
  }, [editMode]);

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
      // The edited text replaces the agent's transcript of this turn
      if (newMessages[message_index].meta?.agent) {
        const { agent, ...meta } = newMessages[message_index].meta;
        newMessages[message_index].meta = meta;
      }
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
    const newMessages = [...localState.messages];
    newMessages.splice(message_index);
    const newState = { ...localState, messages: newMessages };

    setLocalState(newState);
    await sendMessage({ localState: newState, setLocalState });
  };

  const handleForkConversation = useCallback(
    () =>
      confirmAction(
        {
          warningKey: "warn_fork",
          messageKey: "alert.fork_confirm",
          confirmKey: "alert.fork_yes",
        },
        () => forkConversation(message_index)
      ),
    [confirmAction, forkConversation, message_index]
  );

  const content = message?.content?.[0]?.text ?? "";
  // Agent turns are shown from the stored pi transcript, even before a tool call arrives
  const isAgentTurn = Array.isArray(message?.meta?.agent) && message.meta.agent.length > 0;
  
  const hasForms = Array.isArray(message?.content) && message.content.some((i) => i?.type === "form");
  const isContentEmpty = !content.trim() && !hasForms;
  const errorMessage = message?.meta?.error || "Unknown Error";

  // Update the submitted/values of a form content item on this message
  const updateFormContent = (formIndex, patch) => {
    setLocalState((prev) => {
      const messages = [...prev.messages];
      const msg = { ...messages[message_index] };
      const contentArr = Array.isArray(msg.content) ? [...msg.content] : [];
      const item = { ...contentArr[formIndex] };
      item.form = { ...item.form, ...patch };
      contentArr[formIndex] = item;
      msg.content = contentArr;
      messages[message_index] = msg;
      return { ...prev, messages, flush: true };
    });
  };

  return (
    <div
      key={message_index}
      ref={assistantMessage}
      className={`text-base-content overflow-hidden
          ${editMode ? "px-1 pt-1" : "px-3 pt-3"}`}
    >
      {isContentEmpty ? (
        <div
          className={`flex flex-col
            ${loading ? "pb-4" : "pb-3"}`}
        >
          {loading && <Typing />}
          {!loading && (
            <div className="flex flex-col items-center justify-start gap-3 py-1">
              <div className="text-error text-sm font-medium text-center">
              {errorMessage}
              </div>
              <button
                onClick={handleRetry}
                className="btn btn-error btn-soft rounded-full text-sm"
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
                className="p-2 outline-none rounded-sm w-full text-sm text-base-content bg-base-100 resize-y overflow-y-auto"
                placeholder="Edit response..."
                style={{
                  minHeight: `${MIN_HEIGHT}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                }}
              />
              <div className="flex gap-4 justify-end w-full gap-2 pt-1 pb-2 px-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="text-sm text-base-content/70 px-2 py-1 rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave()}
                  className="text-md text-primary border dark:text-accent rounded-full px-3 py-1 cursor-pointer"
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
                className="p-2 outline-none rounded-sm w-full text-sm text-base-content bg-base-100 resize-y overflow-y-auto"
                placeholder="Provide feedback..."
                style={{
                  minHeight: `${MIN_HEIGHT}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                }}
              />
              <div className="flex gap-4 justify-end w-full gap-2 pt-1 pb-2 px-2">
                <button
                  onClick={() => setFeedbackMode(false)}
                  className="text-sm text-base-content/70 px-2 py-1 rounded-full cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveFB()}
                  className="text-md text-primary border dark:text-accent rounded-full px-3 py-1 cursor-pointer"
                >
                  Save & Send FB
                </button>
              </div>
            </div>
          )}          
          {/* Display message content */}
          {!editMode && !feedbackMode && (
            <div className="flex flex-col gap-4">
              {isAgentTurn ? (
                <AgentSteps agentMessages={message.meta.agent} isLoading={loading} renderMode={renderMode} />
              ) : (
                <MarkdownRenderer isLoading={loading} renderMode={renderMode}>
                  {message.content[0]?.text}
                </MarkdownRenderer>
              )}
              {guideFeatureId && (
                <FeatureGuideCard featureId={guideFeatureId} />
              )}
              {guideUseCaseId && (
                <UseCaseGuideCard useCaseId={guideUseCaseId} />
              )}
              {personaPaths.map((path) => (
                <PersonaCard key={path} path={path} />
              ))}
              {metaActions.length > 0 && (
                <MetaActionCard
                  actions={metaActions}
                  localState={localState}
                  setLocalState={setLocalState}
                  modelsData={modelsData}
                  message_index={message_index}
                />
              )}
              {/* Attachments Section */}
              {Array.isArray(message?.content) && message?.content.length > 1 && (
                <div className="flex flex-wrap gap-2 pr-1 pb-1 max-h-24 sm:max-h-28 md:max-h-40 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
                  {message.content.slice(1).filter((a) => a?.type !== "form").map((attachment, i) => (
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
              {/* Editable tool forms */}
              {Array.isArray(message?.content) &&
                message.content.map((item, i) =>
                  item?.type === "form" ? (
                    <ToolForm
                      key={i}
                      form={item.form}
                      localState={localState}
                      setLocalState={setLocalState}
                      onUpdate={(patch) => updateFormContent(i, patch)}
                    />
                  ) : null
                )}
              {/* Bottom panel for message */}
              <div className="group flex justify-between w-full mt-1 gap-2">
                {/* Buttons on the bottom right */}
                <div className="flex items-center justify-end gap-3 overflow-hidden">
                  <CopyButton message={message} />
                  <SpeakButton message={message} />
                  <ForkButton handleForkConversation={handleForkConversation} />
                  <EditButton setEditMode={setEditMode} />
                  {/* Vertical seperator like | */}
                  <div className="hidden md:flex w-px h-6 bg-base-300 opacity-25 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {/* Render Mode Selector on the bottom left*/}
                  <div className="hidden md:flex h-6 bg-base-300 rounded-xl overflow-hidden opacity-25 group-hover:opacity-100 transition-opacity duration-300 ">
                    {renderModes.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => !loading && setRenderMode(mode)}
                        className={`px-2 text-xs font-medium rounded-xl transition-all duration-300 ease-in-out min-w-[60px] cursor-pointer select-none
                    ${loading ? "cursor-not-allowed opacity-25" : ""}
                    ${
                      renderMode === mode
                        ? "bg-accent text-accent-content rounded-xl"
                        : "bg-base-300 text-base-content/70 hover:bg-base-300"
                    }
                    `}
                        disabled={loading}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  { /* Show message metadata */
                  message?.meta && (<div className="w-px h-6 bg-base-300 opacity-25 group-hover:opacity-100 transition-opacity duration-300"></div>)}
                  {
                  message?.meta && (
                    <MetaBox meta={message.meta} /> 
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
              </div>
            </div>
          )}
        </>
      )}
      
    </div>
  );
});
