import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";

import { isAgentEnabled, modelSupportsTools } from "../../apis/agentEndpoints";

// The Browser agent is the default workflow and needs tool support. A model without tools falls
// back to the plain chat path (utils/sendMessage.jsx#shouldUseBrowserAgent) with no file access,
// web search or MCP. Say so above the input so the missing tools are explained.
export default function ModelNoToolsWarning({ localState }) {
  const { t } = useTranslation();

  if (!isAgentEnabled() || modelSupportsTools(localState?.settings?.model)) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{t("settings.model_no_tools_warning")}</span>
    </div>
  );
}
