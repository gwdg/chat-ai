import Tooltip from "../Others/Tooltip";
import { useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";
import { StopFilled } from "@carbon/icons-react";

export default function AbortButton({
    localState,
    setLocalState,
    loading: loadingOverride,
    onAbort,
}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();

    const internalLoading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;
    const loading = loadingOverride ?? internalLoading;

    // Handle cancellation of ongoing request
    const handleAbort = () => {
        if (onAbort) onAbort();
        else abortRequest(notifyError);
    };

    return loading && (
         <Tooltip text={t("common.abort")}>
            {/* Abort Button */}
            <button className="h-7 w-7 cursor-pointer" onClick={handleAbort}>
            <StopFilled size={28} className="cursor-pointer text-accent" />
            </button>
        </Tooltip>
    );
}
