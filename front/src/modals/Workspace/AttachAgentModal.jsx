import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { attachWorkspaceAgent } from "../../db/workspaceDb";

export default function AttachAgentModal({
  isOpen,
  onClose,
  workspaceId,
  agents = [],
  attachedIds = [],
  onAdded,
}) {
  const { t } = useTranslation();
  const attached = useMemo(() => new Set(attachedIds), [attachedIds]);
  const available = useMemo(
    () => agents.filter((agent) => agent?.id && !attached.has(agent.id)),
    [agents, attached],
  );
  const [agentId, setAgentId] = useState(available[0]?.id ?? "");

  const submit = async () => {
    if (!agentId) return;
    await attachWorkspaceAgent(workspaceId, agentId);
    onAdded?.(agentId);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.attach_agent"
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <p className="text-xs text-base-content/70">
          {t("workspace.attach_agent_hint")}
        </p>
        {available.length === 0 ? (
          <p className="text-xs text-base-content/60">
            {t("workspace.no_available_agents")}
          </p>
        ) : (
          <select
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            className="select select-bordered w-full"
          >
            {available.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name || agent.id}
              </option>
            ))}
          </select>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={!agentId}
          >
            {t("workspace.attach_agent")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
