import { Brain, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import {
  selectAllMemories,
  selectDefaultMemoryGroup,
  selectMemoryGroups,
  selectMemoryMode,
} from "../../Redux/reducers/userSettingsReducer";
import { useModal } from "../../modals/ModalContext";

const MEMORY_MODE_OPTIONS = [
  { value: "default", key: "default" },
  { value: 0, key: "none" },
  { value: 1, key: "recall" },
  { value: 2, key: "learn" },
];

const GLOBAL_MEMORY_KEYS = ["none", "recall", "learn"];

export default function MemoryModeContainer({ localState, setLocalState }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const globalMemoryMode = useSelector(selectMemoryMode);
  const memoryGroups = useSelector(selectMemoryGroups);
  const defaultMemoryGroup = useSelector(selectDefaultMemoryGroup);
  const memories = useSelector(selectAllMemories);
  const globalKey = GLOBAL_MEMORY_KEYS[globalMemoryMode] ?? "none";

  const countForGroup = (groupId) =>
    memories.filter((memory) => (memory.groupId ?? "default") === groupId)
      .length;

  const groupOptions = [
    { id: "default", name: t("settings.memory_mode.default_group_name") },
    ...memoryGroups,
  ];
  const defaultGroupName =
    groupOptions.find((group) => group.id === defaultMemoryGroup)?.name ||
    t("settings.memory_mode.default_group_name");
  const rawGroupOverride = localState?.settings?.memory_group_override;
  const selectedGroup =
    rawGroupOverride &&
    rawGroupOverride !== "default" &&
    memoryGroups.some((group) => group.id === rawGroupOverride)
      ? rawGroupOverride
      : "default";

  const rawValue = localState?.settings?.memory_mode_override;
  const currentValue =
    rawValue === undefined || rawValue === null ? "default" : rawValue;
  const normalizedValue =
    currentValue === "default" ? "default" : Number(currentValue);
  const selectedOption =
    MEMORY_MODE_OPTIONS.find((option) => option.value === normalizedValue) ??
    MEMORY_MODE_OPTIONS[0];
  const effectiveMemoryMode =
    normalizedValue === "default" ? globalMemoryMode : normalizedValue;

  const description =
    selectedOption.value === "default"
      ? t("settings.memory_mode.options.default.description", {
          mode: t(
            `user_settings.chat_preferences.memory.options.${globalKey}.label`,
          ),
        })
      : t(
          `settings.memory_mode.options.${selectedOption.key}.description`,
        );

  return (
    <section className="flex flex-col gap-2">
      <div className="min-w-0">
        <div
          className="flex items-center gap-1.5"
          title={t("settings.memory_mode.description")}
        >
          <Brain
            className="h-4 w-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <h3
            id="conversation-memory-mode-label"
            className="text-sm font-medium text-accent"
          >
            {t("settings.memory_mode.label")}
          </h3>
          <button
            type="button"
            onClick={() => openModal("helpMemory")}
            aria-label={t("settings.memory_mode.description")}
            title={t("settings.memory_mode.description")}
            className="rounded-md p-1 text-accent transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 "
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        role="group"
        aria-labelledby="conversation-memory-mode-label"
        className="tabs tabs-box tabs-sm grid min-h-10 grid-cols-4"
      >
        {MEMORY_MODE_OPTIONS.map((option) => {
          const selected = option.value === normalizedValue;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                setLocalState((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    memory_mode_override: option.value,
                  },
                }))
              }
              className={`tab min-w-0 text-xs font-medium ${selected ? "tab-active text-accent!" : ""}`}
            >
              <span className="block truncate">
                {t(`settings.memory_mode.options.${option.key}.label`)}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="text-xs text-base-content/70"
        aria-live="polite"
      >
        {description}
      </p>

      <label className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-accent">
          {t("settings.memory_mode.group_label")}
        </span>
        <select
          value={selectedGroup}
          onChange={(event) => {
            const value = event.target.value;
            const shouldEnableRecall =
              value !== "default" && effectiveMemoryMode === 0;
            setLocalState((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                memory_group_override: value,
                ...(shouldEnableRecall
                  ? { memory_mode_override: 1 }
                  : {}),
              },
            }));
          }}
          className="select select-bordered select-xs min-w-0 flex-1"
        >
          <option value="default">
            {defaultMemoryGroup === "default"
              ? t("settings.memory_mode.default_group_name")
              : t("settings.memory_mode.group_default", {
                  group: defaultGroupName,
                })}{" "}
            ({countForGroup(defaultMemoryGroup)})
          </option>
          {memoryGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} ({countForGroup(group.id)})
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
