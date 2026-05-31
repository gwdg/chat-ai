import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import Tooltip from "../Others/Tooltip";
import { chatCompletions } from "../../apis/chatCompletions";
import { buildConversationForAPI } from "../../utils/sendMessage";
import { selectTimeout } from "../../Redux/reducers/userSettingsReducer";
import SummarizeReplaceModal from "../../modals/Alert/SummarizeReplaceModal";

export default function SummaryButton({
  localState,
  setLocalState
}) {
  const { t } = useTranslation();
  const timeout = useSelector(selectTimeout);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState("confirm"); // "confirm" | "loading" | "success" | "error"
  const [errorMessage, setErrorMessage] = useState("");

  const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

  const handleSummary = async () => {
    // Close the confirm modal first, then reopen as loading
    setModalOpen(false);
    await new Promise(r => setTimeout(r, 200)); // wait for close animation
    setModalStatus("loading");
    setModalOpen(true);
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

      setModalStatus("success");
      // Auto-close after a brief moment
      setTimeout(() => {
        setModalOpen(false);
        setModalStatus("confirm");
      }, 1500);
    } catch (error) {
      // FAILURE: don't touch localState — original conversation preserved
      console.error("Summarization failed:", error);
      setErrorMessage(error?.message || "An unknown error occurred");
      setModalStatus("error");
    }
  };

  const handleClose = () => {
    setModalOpen(false);
    setModalStatus("confirm");
    setErrorMessage("");
  };

  return (
    <>
      <Tooltip text={t("common.summarize")}>
        <button
          className="h-[24px] w-[24px] cursor-pointer"
          onClick={() => setModalOpen(true)}
          disabled={loading || modalOpen}
        >
          <MessageSquareText className="cursor-pointer h-[24px] w-[24px] text-[#009EE0] hover:text-red-500 transition-colors" />
        </button>
      </Tooltip>

      <SummarizeReplaceModal
        isOpen={modalOpen}
        onClose={handleClose}
        onConfirm={handleSummary}
        status={modalStatus}
        errorMessage={errorMessage}
      />
    </>
  );
}
