import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import MarkdownRenderer from "./MarkdownRenderer";
import {
  AssistantMessageContext,
  resolveMessageIndex,
} from "./AssistantMessageContext";
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
import ArcanaActionCard from "./ArcanaActionCard";
import FeedbackButtons from "./FeedbackButtons";
import ForkButton from "./ForkButton";
import SpeakButton from "./SpeakButton";
import AgentSteps from "./AgentSteps";
import ToolForm from "./ToolForm";
import MessageTimestamp from "../MessageTimestamp";
import { getFeatureGuideMarker } from "../../../config/featureGuides";
import { getUseCaseMarker } from "../../../config/useCases";
import { getPersonaMarkers } from "../../../utils/personaCatalog";
import { getMetaActionProposals } from "../../../utils/metaActions";
import { getArcanaActionProposals } from "../../../utils/arcanaActions";
import {
  enrichedFeedbackMessagesFromConversation,
  feedbackTextOf,
  isChatFeedbackEnabled,
  submitFeedbackComment,
  submitFeedbackRating,
} from "../../../apis/feedback";
import { selectFeedbackEnabled } from "../../../Redux/reducers/userSettingsReducer";
import { useToast } from "../../../hooks/useToast";
import { stripThinking } from "../../../utils/thinking";
import { useBrand } from "../../../config/BrandProvider";
import { localizeBrandValue, withBase } from "../../../config/brands";
import { useTranslation } from "react-i18next";

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
  // The value a fence reads must stay stable while its own card updates the
  // message: a changing context value would re-render the whole message (and
  // parse its markdown again) on every quiz keystroke.
  const latestLocalState = useRef(localState);
  latestLocalState.current = localState;
  // A streamed reply has no id until the store writes it, so the identity is
  // the id when there is one and this position otherwise.
  const assistantMessageId = message?.id ?? null;
  const assistantMessageContext = useMemo(() => {
    if (!message || typeof setLocalState !== "function") return null;
    const locate = (messages) =>
      resolveMessageIndex(messages, {
        messageId: assistantMessageId,
        fallbackIndex: message_index,
      });
    return {
      messageId: assistantMessageId,
      getMessage: () => {
        const messages = latestLocalState.current?.messages || [];
        const index = locate(messages);
        return (index >= 0 && messages[index]) || null;
      },
      setMessageMeta: (patch) => {
        setLocalState((previous) => {
          const messages = Array.isArray(previous?.messages)
            ? previous.messages
            : [];
          const index = locate(messages);
          if (index < 0) return previous;
          const current = messages[index];
          const metaPatch =
            typeof patch === "function" ? patch(current?.meta || {}) : patch;
          if (!metaPatch || Object.keys(metaPatch).length === 0) {
            return previous;
          }
          const nextMessages = [...messages];
          nextMessages[index] = {
            ...current,
            meta: { ...(current?.meta || {}), ...metaPatch },
          };
          return { ...previous, messages: nextMessages };
        });
      },
    };
  }, [assistantMessageId, message_index, setLocalState]);
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
  // The Arcana chat is not a conversation row; its id carries the collection.
  // A marker in an ordinary chat therefore never reaches the approval card.
  const arcanaCollection = String(localState?.id || "").startsWith(
    "arcana-chat:",
  )
    ? localState.id.slice("arcana-chat:".length)
    : null;
  const arcanaActions =
    arcanaCollection && !loading
      ? getArcanaActionProposals(
          message?.content?.[0]?.text,
          arcanaCollection,
        )
      : [];
  const [renderMode, setRenderMode] = useState("Default");
  // Define render modes with better styling
  const renderModes = ["Default", "Markdown", "Plaintext"];
  
  const sendMessage = useSendMessage();
  const { forkConversation } = useForkConversation(localState);
  const { confirmAction } = useModal();
  const feedbackEnabled = useSelector(selectFeedbackEnabled);
  const feedbackModule = feedbackEnabled && isChatFeedbackEnabled();
  const { notifyError } = useToast();
  const { i18n, t } = useTranslation();
  const { brand } = useBrand();
  // The brand's AI marker (GAIA's "AI" label) beside every assistant message,
  // and the sentence appended to copied text. Both are brand data, so a brand
  // without an `aiMarker` renders neither.
  const aiMarkerAsset = brand?.aiMarker?.asset
    ? withBase(brand.aiMarker.asset)
    : null;
  const aiMarkerLabel = localizeBrandValue(brand?.aiMarker?.label, i18n.language);
  const copyWatermark =
    localizeBrandValue(brand?.aiMarker?.watermark, i18n.language) || "";
  const aiMarkerInvert = brand?.aiMarker?.monochrome === true ? "dark:invert" : "";

  //Functions
  const adjustHeight = () => {
    if (editBox.current) {
      editBox.current.style.height = `${MIN_HEIGHT}px`;

      const scrollHeight = editBox.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

      editBox.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };
  
  // Rates the answer, or updates its comment. The feedback is stored on the
  // message and sent straight to the deployment's receiver, so rating never
  // starts a model turn. Clearing a thumb only clears the stored rating; a
  // comment saved without a thumb is filed as a report of its own.
  const sendFeedbackFunc = async (
    ratingInt,
    commentStr,
    expectedStr,
    { submitComment = false } = {},
  ) => {
    const target = localState.messages[message_index];
    if (!target) return;
    const rated = ratingInt === 1 || ratingInt === -1;
    const resultText =
      (typeof expectedStr === "string" && expectedStr) ||
      stripThinking(feedbackTextOf(target.content));
    const feedback = {};
    if (rated) feedback.rating = ratingInt;
    if (typeof commentStr === "string" && commentStr.trim()) {
      feedback.comment = commentStr;
    }
    if (resultText) feedback.result = resultText;

    setLocalState((prev) => {
      const messages = [...prev.messages];
      const current = messages[message_index];
      if (!current) return prev;
      const { feedback: _previous, ...rest } = current;
      messages[message_index] = Object.keys(feedback).length
        ? { ...rest, feedback }
        : rest;
      return { ...prev, messages };
    });

    const ratedMessages = (
      await enrichedFeedbackMessagesFromConversation(
        localState.messages.slice(0, message_index + 1),
      )
    ).slice(-2);

    if (!rated) {
      // Only the comment box asks for this; a thumb that was clicked off must
      // not send anything.
      if (!submitComment || !feedback.comment) return;
      try {
        await submitFeedbackComment({
          comment: feedback.comment,
          messages: ratedMessages,
          model: localState.settings?.model,
          conversationId: localState.id,
          title: localState.title,
        });
      } catch (error) {
        notifyError(
          t("feedback.send_failed", {
            error: error?.message || t("feedback.unknown_error"),
          }),
        );
      }
      return;
    }
    try {
      await submitFeedbackRating({
        rating: ratingInt,
        result: resultText,
        comment: commentStr || "",
        messages: ratedMessages,
        model: localState.settings?.model,
        conversationId: localState.id,
        title: localState.title,
      });
    } catch (error) {
      notifyError(
        t("feedback.send_failed", {
          error: error?.message || t("feedback.unknown_error"),
        }),
      );
    }
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
    sendFeedbackFunc(msg.feedback?.rating, feedbackText, msg?.feedback?.result, {
      submitComment: true,
    });
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
              <div>{t("feedback.data_notice")}</div>

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
                placeholder={t("feedback.comment_placeholder")}
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
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => handleSaveFB()}
                  className="text-md text-primary border dark:text-accent rounded-full px-3 py-1 cursor-pointer"
                >
                  {t("feedback.save_and_send")}
                </button>
              </div>
            </div>
          )}
          {/* Display message content */}
          {!editMode && !feedbackMode && (
            <div className="flex flex-col gap-4">
              <AssistantMessageContext.Provider
                value={assistantMessageContext}
              >
                {isAgentTurn ? (
                  <AgentSteps agentMessages={message.meta.agent} isLoading={loading} renderMode={renderMode} />
                ) : (
                  <MarkdownRenderer isLoading={loading} renderMode={renderMode}>
                    {message.content[0]?.text}
                  </MarkdownRenderer>
                )}
              </AssistantMessageContext.Provider>
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
              {arcanaActions.length > 0 && (
                <ArcanaActionCard
                  actions={arcanaActions}
                  localState={localState}
                  setLocalState={setLocalState}
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
              <MessageTimestamp message={message} className="pt-1" />
              {/* Bottom panel for message */}
              <div className="group flex justify-between w-full mt-1 gap-2">
                {/* Buttons on the bottom right */}
                <div className="flex items-center justify-end gap-3 overflow-hidden">
                  {aiMarkerAsset && (
                    <span
                      className="inline-flex h-[18px] items-center"
                      title={aiMarkerLabel}
                      aria-label={aiMarkerLabel}
                    >
                      <img
                        src={aiMarkerAsset}
                        alt={aiMarkerLabel || "AI"}
                        className={`h-[18px] w-auto opacity-70 ${aiMarkerInvert}`}
                      />
                    </span>
                  )}
                  <CopyButton message={message} appendText={copyWatermark} />
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
