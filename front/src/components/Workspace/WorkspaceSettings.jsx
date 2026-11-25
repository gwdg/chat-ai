import { useTranslation } from "react-i18next";

import { isAgentEnabled } from "../../apis/agentEndpoints";
import ToolLimit from "../SettingsPanel/ToolLimit";

// The Browser agent is the default workflow, so this section only keeps the per-chat limit for
// tool calls. Writing is part of "Access storage" (see WorkspaceAttachButton).
export default function WorkspaceSettings({ localState, setLocalState }) {
  const { t } = useTranslation();
  const agentMode = isAgentEnabled();

  return (
    <div className="space-y-2 border-t border-base-300 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-base-content/45">
        {t("workspace.settings_title")}
      </p>
      {agentMode && (
        <ToolLimit localState={localState} setLocalState={setLocalState} />
      )}
    </div>
  );
}
