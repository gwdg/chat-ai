import type { WorkspaceSourceRow } from "../db/dbTypes";

/**
 * Agent filesystem sources are derived from the agents attached to a workspace, which the
 * workspace page already lists in its Agents panel. Keep those sources out of "Available
 * storage" so the same agent name is not shown twice. Sources for agents that only reach the
 * workspace through the bridge stay visible, because no Agents row represents them.
 */
export function visibleWorkspaceSources(
  sources: WorkspaceSourceRow[] | undefined,
  attachedAgents: { id: string }[] | undefined,
): WorkspaceSourceRow[] {
  const attached = new Set((attachedAgents || []).map((agent) => agent?.id));
  return (sources || []).filter((source) => {
    if (source.kind !== "agent") return true;
    const agentId = String((source.config as any)?.agentId ?? "");
    return !agentId || !attached.has(agentId);
  });
}
