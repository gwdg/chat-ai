import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import {
  getMcpConfirmation,
  resolveMcpConfirmation,
  subscribeMcpConfirmations,
} from "../../../agent/mcpConfirmation";

export default function McpConfirmationCard({ callId }) {
  const { t } = useTranslation();
  const pending = useSyncExternalStore(
    subscribeMcpConfirmations,
    () => getMcpConfirmation(callId),
  );
  if (!pending) return null;

  return (
    <div className="mt-1 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
      <div className="flex items-start gap-1.5">
        <TriangleAlert
          size={16}
          className="mt-0.5 shrink-0 text-warning"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-base-content">
            {t("mcp_confirmation.title")}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-base-content/70">
            {t("mcp_confirmation.description", {
              tool: pending.tool,
              server: pending.server,
            })}
          </p>
          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-base-100/60 p-1.5 font-mono text-[10px] text-base-content/80">
            {JSON.stringify(pending.args, null, 2)}
          </pre>
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => resolveMcpConfirmation(callId, false)}
            >
              {t("mcp_confirmation.deny")}
            </button>
            <button
              type="button"
              className="btn btn-warning btn-xs gap-1.5"
              onClick={() => resolveMcpConfirmation(callId, true)}
            >
              <TriangleAlert size={14} aria-hidden="true" />
              {t("mcp_confirmation.allow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
