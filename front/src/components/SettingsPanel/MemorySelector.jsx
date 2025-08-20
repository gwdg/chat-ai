import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

export default function MemorySelector({ localState, setLocalState }) {
  const { openModal } = useModal();
  return (
    <div className="w-full flex gap-4">
      <div className="flex-shrink-0 flex items-center gap-2 select-none">
        <p className="text-sm">Memory</p>
        <HelpCircle
          className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
          alt="help"
          onClick={() => openModal("helpMemory")}
        />
      </div>
      <div className="w-full">
        <div className="flex bg-white dark:bg-bg_secondary_dark border dark:border-border_dark rounded-xl shadow-lg dark:shadow-dark overflow-hidden">
          {/* None Option */}
          <div
            className={`memory-option-off flex-1 p-2 text-center cursor-pointer transition-all duration-200 select-none ${
              localState.settings.memory === 0
                ? "bg-tertiary text-white"
                : "text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            onClick={() =>
              setLocalState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  memory: 0,
                },
              }))
            }
          >
            <p className="text-xs font-medium">None</p>
          </div>

          {/* Recall Option */}
          <div
            className={`memory-option-recall flex-1 p-2 text-center cursor-pointer transition-all duration-200 select-none border-l border-r dark:border-border_dark ${
              localState.settings.memory === 1
                ? "bg-tertiary text-white"
                : "text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            onClick={() =>
              setLocalState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  memory: 1,
                },
              }))
            }
          >
            <p className="text-xs font-medium">Recall</p>
          </div>

          {/* Learn Option */}
          <div
            className={`memory-option-on flex-1 p-2 text-center cursor-pointer transition-all duration-200 select-none ${
              localState.settings.memory === 2
                ? "bg-tertiary text-white"
                : "text-tertiary hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            onClick={() =>
              setLocalState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  memory: 2,
                },
              }))
            }
          >
            <p className="text-xs font-medium">Learn</p>
          </div>
        </div>
      </div>
    </div>
  );
}
