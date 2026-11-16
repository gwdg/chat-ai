import { useTranslation } from "react-i18next";
import { Code, Pencil } from "lucide-react";

import { isAgentEnabled } from "../../apis/agentEndpoints";
import { storageAccessEnabled } from "../../agent/storageAccess";
import MiniToolButton from "../SettingsPanel/MiniToolButton";
import ToolLimit from "../SettingsPanel/ToolLimit";

export default function WorkspaceSettings({
  localState,
  setLocalState,
  workspaceAttached = false,
}) {
  const { t } = useTranslation();
  const agentMode = isAgentEnabled();
  const storageOn = storageAccessEnabled(localState?.settings);
  const codemodeEnabled = localState?.settings?.tools?.codemode !== false;
  const writeEnabled = localState?.settings?.tools?.write_access === true;

  const setTool = (key, enabled) =>
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, [key]: enabled },
      },
      flush: true,
    }));

  // A chat attached to a workspace always writes there (agent/storageAccess.ts), so the switch is
  // only offered where the stored flag actually decides.
  const writeTitle = storageOn
    ? t("settings.label_write_access")
    : t("settings.tools_requires_browser_storage");

  return (
    <div className="space-y-2 border-t border-base-300 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45">
        {t("workspace.settings_title")}
      </p>
      {agentMode && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          <MiniToolButton
            active={codemodeEnabled}
            onClick={() => setTool("codemode", !codemodeEnabled)}
            Icon={Code}
            label={t("settings.label_codemode")}
            guideKey="codemode"
          />
          {!workspaceAttached && (
            <MiniToolButton
              active={writeEnabled}
              disabled={!storageOn}
              onClick={() => setTool("write_access", !writeEnabled)}
              Icon={Pencil}
              label={t("settings.label_write_access")}
              title={writeTitle}
              guideKey="write_access"
            />
          )}
        </div>
      )}
      <ToolLimit localState={localState} setLocalState={setLocalState} />
    </div>
  );
}
