import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

export default function ToolsToggle({ localState, setLocalState }) {
  const { openModal } = useModal();
  const settings = localState.settings;
  return (
    <div className="flex flex-col md:flex-row md:gap-4 gap-3 w-full md:items-center">
      <div className="flex-shrink-0 flex items-center gap-2 select-none">
        <p className="text-sm">Use GWDG Tools</p>
        {/* Help Button */}

        <HelpCircle
          className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
          alt="help"
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
              flush: true,
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
            Additional features are enabled.
          </span>
        )}
      </div>
    </div>
  );
}
