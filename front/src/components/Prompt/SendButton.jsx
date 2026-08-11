import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { useSendMessage } from "../../hooks/useSendMessage";
import { Send } from "@carbon/icons-react";

export default function SendButton({localState, setLocalState, handleSend, prompt}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();

    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;
    const attachments = localState.messages[localState.messages.length - 1].content.slice(1);

    return !loading && (prompt !== "" || attachments.length > 0) &&  (
         <Tooltip text={t("common.send")}>
            <Send
                className="cursor-pointer h-7 w-7 text-tertiary"
                onClick={handleSend}
            />
        </Tooltip>
    );
}