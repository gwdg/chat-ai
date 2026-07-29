import { Brain, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { selectAllMemories } from "../../Redux/reducers/userSettingsReducer";
import { useModal } from "../ModalContext";

export default function UserMemoryContainer({ localState }) {
  const { t } = useTranslation();
  const memories = useSelector(selectAllMemories);
  const { openModal } = useModal();

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-tertiary" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t("user_settings.memory.title")}
          </h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {t("user_settings.memory.description", { count: memories.length })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => openModal("userMemory", { localState })}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:border-gray-700 dark:hover:bg-gray-800/70"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary/10 text-tertiary dark:bg-tertiary/20 dark:text-blue-300">
          <Brain className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
          {t("user_settings.memory.manage")}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {memories.length}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-gray-400"
          aria-hidden="true"
        />
      </button>
    </section>
  );
}
