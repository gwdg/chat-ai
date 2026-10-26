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
          <Brain className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="text-sm font-medium text-base-content">
            {t("user_settings.memory.title")}
          </h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-base-content/70">
          {t("user_settings.memory.description", { count: memories.length })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => openModal("userMemory", { localState })}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-base-300 px-3 py-2.5 text-left transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent dark:bg-accent/20 dark:text-blue-300">
          <Brain className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-base-content">
          {t("user_settings.memory.manage")}
        </span>
        <span className="rounded-full bg-base-200 px-2 py-0.5 text-xs font-semibold tabular-nums text-base-content/70">
          {memories.length}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-base-content/50"
          aria-hidden="true"
        />
      </button>
    </section>
  );
}
