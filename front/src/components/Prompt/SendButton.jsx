import icon_send from "../../assets/icons/send.svg";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useToast } from "../../hooks/useToast";
import { useSendMessage } from "../../hooks/useSendMessage";

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
            <button
            className="h-[30px] w-[30px] cursor-pointer"
            disabled={loading}
            onClick={handleSend}
            >
            {loading ? null : <img
                className="cursor-pointer h-[30px] w-[30px]"
                src={icon_send}
                alt="send"
            />
            }
            </button>
        </Tooltip>
    );
}