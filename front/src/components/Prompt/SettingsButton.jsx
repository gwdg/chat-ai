import icon_settings from "../../assets/icons/settings.svg";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";
import { useDispatch, useSelector } from "react-redux";
import { toggleSettings } from "../../Redux/reducers/interfaceSettingsSlice";
import { selectShowSettings } from "../../Redux/reducers/interfaceSettingsSlice";

export default function SettingsButton() {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();
    const dispatch = useDispatch();
    const showSettings = useSelector(selectShowSettings);

    return !showSettings ? (
        <Tooltip text={t("description.settings_toggle")}>
            <button
            className="flex h-[25px] w-[25px] cursor-pointer"
            onClick={() => dispatch(toggleSettings())}
            >
            <img
                className="cursor-pointer h-[25px] w-[25px]"
                src={icon_settings}
                alt="settings"
            />
            </button>
        </Tooltip>
    ) : null;
}