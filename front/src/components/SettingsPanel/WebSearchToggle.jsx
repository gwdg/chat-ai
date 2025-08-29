import { useModal } from "../../modals/ModalContext";
import { HelpCircle } from "lucide-react";

export default function WebSearchToggle({ localState, setLocalState }) {
  const { openModal } = useModal();
  const settings = localState.settings;
  return (
    settings?.enable_tools && (
      <div className="flex flex-col md:flex-row md:gap-2 gap-2 w-full md:items-center mt-2">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">Allow Web Search</p>
          {/* Help Button */}
          <HelpCircle
            className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
            alt="help"
            onClick={() => openModal("helpTools")}
          />
        </div>
        <div className="w-full flex items-center">
          <input
            type="checkbox"
            checked={settings?.enable_tools && settings?.enable_web_search}
            onChange={(e) =>
              setLocalState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  enable_web_search: e.target.checked,
                },
                flush: true,
              }))
            }
            className="h-4 w-4 text-tertiary bg-gray-200 border-gray-300 rounded focus:ring-tertiary focus:ring-2"
          />
          {/* Description that appears only when the box is unchecked */}
          {!settings?.enable_web_search && (
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
              Web search is disabled
            </span>
          )}
          {/* Description that appears only when the box is checked */}
          {settings?.enable_web_search && (
            <span className="ml-2 text-sm text-green-600 dark:text-green-300">
              Web search is enabled
            </span>
          )}
        </div>
      </div>
    )
  );
}
