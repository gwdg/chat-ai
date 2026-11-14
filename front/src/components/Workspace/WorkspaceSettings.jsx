import { useTranslation } from "react-i18next";
import { Code } from "lucide-react";

import { isAgentEnabled } from "../../apis/agentEndpoints";
import MiniToolButton from "../SettingsPanel/MiniToolButton";
import ToolLimit from "../SettingsPanel/ToolLimit";

export default function WorkspaceSettings({ localState, setLocalState }) {
  const { t } = useTranslation();
  const agentMode = isAgentEnabled();
  const codemodeEnabled = localState?.settings?.tools?.codemode !== false;

  const setCodemode = (enabled) =>
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, codemode: enabled },
      },
      flush: true,
    }));

  return (
    <div className="space-y-2 border-t border-base-300 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45">
        {t("workspace.settings_title")}
      </p>
      {agentMode && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          <MiniToolButton
            active={codemodeEnabled}
            onClick={() => setCodemode(!codemodeEnabled)}
            Icon={Code}
            label={t("settings.label_codemode")}
            guideKey="codemode"
          />
        </div>
      )}
      <ToolLimit localState={localState} setLocalState={setLocalState} />
    </div>
  );
}
