import { useTranslation } from "react-i18next";

// Tool invocations per agent response; batched calls count once. Stored as
// settings.max_tool_calls: missing = 10, 0 = no limit (agent/runAgent.ts).
const DEFAULT_TOOL_LIMIT = 10;

export default function ToolLimit({ localState, setLocalState }) {
  const { t } = useTranslation();
  const value = localState?.settings?.max_tool_calls ?? DEFAULT_TOOL_LIMIT;
  const limited = value > 0;
  const set = (max_tool_calls) =>
    setLocalState((prev) => ({ ...prev, settings: { ...prev.settings, max_tool_calls }, flush: true }));

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm select-none">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={limited}
          onChange={() => set(limited ? 0 : DEFAULT_TOOL_LIMIT)}
          className="h-4 w-4 accent-primary"
        />
        {t("settings.label_tool_limit")}
      </label>
      {limited && (
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            if (n >= 1) set(n);
          }}
          aria-label={t("settings.label_tool_limit")}
          title={t("settings.tool_limit_hint")}
          className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-bg_dark px-2 py-1"
        />
      )}
    </div>
  );
}
