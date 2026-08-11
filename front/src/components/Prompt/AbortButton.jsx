import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";
import { StopFilled } from "@carbon/icons-react";

export default function AbortButton({
    localState,
    setLocalState,
}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();

    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

    // Handle cancellation of ongoing request
    const handleAbort = () => {
        abortRequest(notifyError);
    };

    return loading && (
         <Tooltip text={t("common.abort")}>
            {/* Abort Button */}
            <button className="h-7 w-7 cursor-pointer" onClick={handleAbort}>
            <StopFilled className="cursor-pointer h-7 w-7 text-tertiary" />
            </button>
        </Tooltip>
    );
}