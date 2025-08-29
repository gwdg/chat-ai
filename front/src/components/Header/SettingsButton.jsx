import icon_settings from "../../assets/icons/settings.svg";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";
import { useDispatch, useSelector } from "react-redux";
import { selectShowSidebar, toggleSettings, toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";
import { selectShowSettings } from "../../Redux/reducers/interfaceSettingsSlice";
import { Settings } from "lucide-react";

export default function SettingsButton() {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();
    const dispatch = useDispatch();
    const showSettings = useSelector(selectShowSettings);
    const showSidebar = useSelector(selectShowSidebar);

    return ( 
        <button
        className="flex h-[25px] w-[25px] cursor-pointer"
        onClick={() => {
            if (showSidebar) dispatch(toggleSidebar());
            dispatch(toggleSettings());
        }}
        >
        <Settings
            className="cursor-pointer h-[25px] w-[25px] text-[#009EE0]"
            alt="settings"
        />
        </button>
    );
}