import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { useSendMessage } from "../../hooks/useSendMessage";
import { Send, SendFilled } from "@carbon/icons-react";

export default function SendButton({localState, setLocalState, handleSend, prompt}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();

    function isSafeSettings(localState) {
        const modelName = localState?.settings?.model?.name;
        const isExternalModel =
            typeof modelName === "string" &&
            modelName.toLowerCase().includes("external");

        const toolsEnabled = !!localState?.settings?.enable_tools;
        const tools = localState?.settings?.tools || {};

        // Web search should only trigger warnings when the toolset is active
        const webSearchEnabled =
            toolsEnabled &&
            (localState?.settings?.enable_web_search ||
            !!tools.web_search ||
            !!tools.fetch_url);

        const mcpEnabled = toolsEnabled && !!tools.mcp;

        return !(isExternalModel || webSearchEnabled || mcpEnabled);
    }

    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;
    const attachments = localState.messages[localState.messages.length - 1].content.slice(1);
    const isSafe = isSafeSettings(localState);

    return !loading && ( (prompt !== "" || attachments.length > 0)  ? (
         <Tooltip text={t("common.send")}>
            <SendFilled size={28} className={"cursor-pointer " + (isSafe ? "text-green-600" : "text-yellow-600")} onClick={handleSend} />
        </Tooltip>
    ) : (
        <Tooltip text={t("common.send")}>
            <SendFilled size={28} className={"opacity-10 " + (isSafe ? "text-green-600" : "text-yellow-600")} />
        </Tooltip>
    ))
    
}