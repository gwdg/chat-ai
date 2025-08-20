import icon_stop from "../../assets/icons/stop.svg";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";

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
         <Tooltip text={t("description.pause")}>
            {/* Abort Button */}
            <button className="h-[30px] w-[30px] cursor-pointer">
            <img
                className="cursor-pointer h-[30px] w-[30px]"
                src={icon_stop}
                alt="abort"
                onClick={handleAbort}
            />
            </button>
        </Tooltip>
    );
}