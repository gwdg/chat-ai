import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { useSendMessage } from "../../hooks/useSendMessage";
import { useSendWithEnter } from "../../hooks/useSendWithEnter";
import { Send, SendFilled } from "@carbon/icons-react";
import { isAgentEnabled } from "../../apis/agentEndpoints";
import { activeMcpServers } from "../../agent/mcp";

export default function SendButton({localState, setLocalState, handleSend, prompt}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();
    const sendWithEnter = useSendWithEnter();
    const sendShortcutKey = sendWithEnter
        ? "common.send_shortcut"
        : "common.send_shortcut_shift_enter";

    function isSafeSettings(localState) {
        const modelName = localState?.settings?.model?.name;
        const isExternalModel =
            typeof modelName === "string" &&
            modelName.toLowerCase().includes("external");

        // The agent does not use the gateway web search; it calls MCP servers itself (agent/mcp.ts)
        const toolsEnabled = !!localState?.settings?.enable_tools && !isAgentEnabled();
        const tools = localState?.settings?.tools || {};

        // Web search should only trigger warnings when the toolset is active
        const webSearchEnabled =
            toolsEnabled &&
            (localState?.settings?.enable_web_search ||
            !!tools.web_search ||
            !!tools.fetch_url);

        const mcpEnabled = isAgentEnabled() ? activeMcpServers(localState?.settings).length > 0 : toolsEnabled && !!tools.mcp;

        return !(isExternalModel || webSearchEnabled || mcpEnabled);
    }

    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;
    const attachments = localState.messages[localState.messages.length - 1].content.slice(1);
    const isSafe = isSafeSettings(localState);

    return !loading && ( (prompt !== "" || attachments.length > 0)  ? (
         <Tooltip text={t(sendShortcutKey)}>
            <SendFilled size={28} className={"cursor-pointer " + (isSafe ? "text-success" : "text-warning")} onClick={handleSend} data-guide="send" />
        </Tooltip>
    ) : (
        <Tooltip text={t(sendShortcutKey)}>
            <SendFilled size={28} className={"opacity-10 " + (isSafe ? "text-success" : "text-warning")} data-guide="send" />
        </Tooltip>
    ))
    
}