import { Trans } from "react-i18next";
import { useState } from "react";
import { useSelector } from "react-redux";
import BaseModal from "../BaseModal";
import { buildConversationForAPI } from "../../utils/sendMessage";
import { chatCompletions } from "../../apis/chatCompletions";
import { selectTimeout } from "../../Redux/reducers/userSettingsReducer";

/**
 * status: "confirm" | "loading" | "success" | "error"
 * onConfirm: called when user clicks Summarize
 * onClose: called to close the modal
 * errorMessage: optional error string when status === "error"
 */
export default function SummarizeChatModal({
  isOpen,
  onClose,
  localState,
  setLocalState,
}) {
  const [status, setStatus] = useState("confirm")
  const [errorMessage, setErrorMessage] = useState("")
  const isLoading = status === "loading";

  const chatLoading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;
  const timeout = useSelector(selectTimeout);

  const handleSummary = async () => {
    // Close the confirm modal first, then reopen as loading
    await new Promise(r => setTimeout(r, 200)); // wait for close animation
    setStatus("loading");
    try {
      // Deep-copy messages for the API payload — don't touch localState
      const messagesCopy = localState.messages.map(msg => ({
        ...msg,
        content: Array.isArray(msg.content)
          ? msg.content.map(item => ({ ...item }))
          : msg.content,
      }));

      // Save original system prompt to restore on success
      const originalSystemPrompt = messagesCopy[0].content[0].text;

      // Replace system prompt with summarization instruction
      messagesCopy[0].content[0].text =
        "You are a helpful assistant that tries to summarize our conversation into a crisp summary. Include all details needed to summarize the conversation accurately. You will not do ANYTHING else except summarizing our conversation, do not include boilerplate.";

      // Replace last user message with summarization request
      messagesCopy[messagesCopy.length - 1].content[0].text = "Summarize our conversation now.";

      // Build API-ready payload (processes file attachments to base64 etc.)
      const summaryLocalState = { ...localState, messages: messagesCopy };
      const conversationForAPI = await buildConversationForAPI(summaryLocalState);

      // Extract system prompt for API format
      const systemPrompt = conversationForAPI.messages[0]?.role === "system"
        ? (typeof conversationForAPI.messages[0].content === "string"
            ? conversationForAPI.messages[0].content
            : conversationForAPI.messages[0].content[0]?.text || "")
        : "";

      // Filter to user/assistant only, prepend system prompt
      const filteredMessages = conversationForAPI.messages.filter(
        msg => msg.role === "user" || msg.role === "assistant"
      );

      const apiPayload = {
        ...conversationForAPI,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...filteredMessages,
        ],
      };

      // Strip tools — summarization is pure text
      apiPayload.settings.enable_tools = false;
      delete apiPayload.settings.tools;
      delete apiPayload.settings.mcp_servers;
      delete apiPayload.settings.arcana;

      // Call API directly and collect full response
      const timeoutAPI = (timeout >= 5000 && timeout <= 900000) ? timeout : 300000;
      let summaryText = "";

      for await (const chunk of chatCompletions(apiPayload, timeoutAPI)) {
        const delta = chunk?.choices?.[0]?.delta;
        if (delta?.content && typeof delta.content === "string") {
          summaryText += delta.content;
        }
      }

      // Validate we got a real summary back
      if (!summaryText.trim()) {
        throw new Error("Received empty summary from API");
      }

      // SUCCESS: atomically replace conversation with summary
      setLocalState(prev => ({
        ...prev,
        messages: [
          { role: "system", content: [{ type: "text", text: originalSystemPrompt }] },
          { role: "user", content: [{ type: "text", text: "Please summarize our conversation so far" }] },
          { role: "assistant", content: [{ type: "text", text: summaryText }], loading: false },
          { role: "user", content: [{ type: "text", text: "" }] },
        ],
        flush: true,
      }));

      setStatus("success");
      // Auto-close after a brief moment
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      // FAILURE: don't touch localState — original conversation preserved
      console.error("Summarization failed:", error);
      setErrorMessage(error?.message || "An unknown error occurred");
      setStatus("error");
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      titleKey="common.summarize"
      maxWidth="max-w-md"
      isForced={isLoading}
    >
      {/* Confirm state */}
      {status === "confirm" && (
        <>
          <div className="pt-0 pb-2">
            <p className="dark:text-white text-black text-justify text-sm">
              <Trans i18nKey="alert.summarize_replace" />
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm">
            <button
              type="button"
              className="cursor-pointer px-5 py-3 rounded-lg font-medium
                        text-gray-700 bg-gray-200 border border-gray-300
                        hover:bg-gray-300 hover:border-gray-400
                        active:scale-95 transition-all duration-200
                        dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600
                        dark:hover:bg-gray-600"
              onClick={onClose}
            >
              <Trans i18nKey="common.cancel" />
            </button>

            <button
              type="button"
              className="cursor-pointer px-5 py-3 rounded-lg font-medium
                        text-white bg-red-600 border border-red-700
                        hover:bg-red-700 hover:border-red-800
                        active:scale-95 transition-all duration-200 shadow-md
                        disabled:opacity-50
                        dark:shadow-black/30"
              onClick={handleSummary}
              disabled={chatLoading}
            >
              <Trans i18nKey="common.summarize" />
            </button>
          </div>
        </>
      )}

      {/* Loading state */}
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-300 dark:border-gray-600 border-t-[#009EE0]" />
          <p className="dark:text-white text-black text-sm font-medium">
            <Trans i18nKey="common.summarizing" />
          </p>
          <p className="dark:text-gray-400 text-gray-500 text-xs text-center">
            <Trans i18nKey="alert.summarize_in_progress" />
          </p>
        </div>
      )}

      {/* Success state */}
      {status === "success" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="dark:text-white text-black text-sm font-medium">
            <Trans i18nKey="common.summarize_success" />
          </p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="dark:text-white text-black text-sm font-medium">
              <Trans i18nKey="common.summarize_error" />
            </p>
            {errorMessage && (
              <p className="dark:text-gray-400 text-gray-500 text-xs text-center max-w-full break-words">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="flex justify-center w-full text-sm">
            <button
              type="button"
              className="cursor-pointer px-5 py-3 rounded-lg font-medium
                        text-gray-700 bg-gray-200 border border-gray-300
                        hover:bg-gray-300 hover:border-gray-400
                        active:scale-95 transition-all duration-200
                        dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600
                        dark:hover:bg-gray-600"
              onClick={onClose}
            >
              <Trans i18nKey="common.close" />
            </button>
          </div>
        </>
      )}
    </BaseModal>
  );
}
