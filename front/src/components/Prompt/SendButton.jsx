import icon_send from "../../assets/icons/send.svg";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { useSendMessage } from "../../hooks/useSendMessage";
import { Send } from "lucide-react";

export default function SendButton({localState, setLocalState, handleSend}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();

    const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";
    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;
    const attachments = localState.messages[localState.messages.length - 1].content.slice(1);

    return !loading && (prompt !== "" || attachments.length > 0) &&  (
         <Tooltip text={t("description.send")}>
            <Send
                className="cursor-pointer h-[28px] w-[28px] text-[#009EE0]"
                alt="send"
                onClick={handleSend}
                disabled={loading}
            />
        </Tooltip>
    );
}