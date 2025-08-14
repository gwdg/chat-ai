import { useState } from "react";
import icon_help from "../../assets/icons/help.svg";
import { useModal } from "../../modals/ModalContext";

export default function GWDGToggle({ localState, setLocalState}) {
    const { openModal } = useModal();
    const settings = localState.settings;
    return (
        <div className="flex flex-col md:flex-row md:gap-4 gap-3 w-full md:items-center mt-4">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
            <p className="text-sm">Use GWDG Tools</p>
            {/* If you ever want a tooltip/help‑icon you can reuse the same pattern */}
            <img
            src={icon_help}
            alt="help"
            className="h-[16px] w-[16px] cursor-pointer"
            onClick={() => openModal("helpTools")}
            />
        </div>
        <div className="w-full flex items-center">
            <input
                id="use-gwdg-tools"
                type="checkbox"
                checked={settings?.enable_tools}
                onChange={(e) =>
                setLocalState((prev) => ({
                    ...prev,
                    settings: {
                    ...prev.settings,
                    enable_tools: e.target.checked,
                    },
                }))
                }
                className="h-4 w-4 text-tertiary bg-gray-200 border-gray-300 rounded focus:ring-tertiary focus:ring-2"
            />
            {/* Description that appears only when the box is unchecked */}
            {!settings?.enable_tools && (
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                Additional features are disabled.
                </span>
            )}
            {/* Description that appears only when the box is checked */}
            {settings?.enable_tools && (
                <span className="ml-2 text-sm text-green-600 dark:text-green-300">
                Additional features are now enabled.
                </span>
            )}
        </div>
        </div>
    )
}