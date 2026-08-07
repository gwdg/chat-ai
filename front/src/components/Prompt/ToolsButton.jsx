import { Fragment } from "react";
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Blocks } from "lucide-react";
import Tooltip from "../Others/Tooltip";
import ToolsContainer from "../SettingsPanel/ToolsContainer";

export default function ToolsButton({ localState, setLocalState }) {
    const { t } = useTranslation();
    const toolsModule = import.meta.env.VITE_MODULE_TOOLS === "true";
    if (!toolsModule) return null;

    return (
        <Popover className="relative flex">
            <Tooltip text={t("settings.tools_title")}>
                <PopoverButton className="flex cursor-pointer focus:outline-none">
                    <Blocks
                        className="cursor-pointer h-7 w-7 text-[#009EE0]"
                        alt="tools"
                    />
                </PopoverButton>
            </Tooltip>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
            >
                <PopoverPanel
                    anchor="top"
                    className="z-50 mb-2 w-[26rem] max-w-[90vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-bg_secondary_dark shadow-xl dark:shadow-dark p-4"
                >
                    <ToolsContainer localState={localState} setLocalState={setLocalState} />
                </PopoverPanel>
            </Transition>
        </Popover>
    );
}
