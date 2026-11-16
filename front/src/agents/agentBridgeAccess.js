import { updateAgent } from "./agentStore";

/**
 * Agent workspace access is explicit, with one exception for existing data: agents that already
 * had an active bridge workspace keep their access on. New agents start without it.
 */
export const isAgentBridgeEnabled = (agent) =>
  agent?.bridgeEnabled ?? !!agent?.bridgeWorkspaceId;

/**
 * Switch access on or off. Turning it on picks a workspace if the agent has none yet, so the
 * reverse proxy can start right away; turning it off only flips the switch and keeps the chosen
 * workspace, so switching back on restores it.
 */
export const setAgentBridgeEnabled = (agent, enabled, workspaces = []) => {
  if (!agent?.id) return;
  updateAgent(agent.id, {
    bridgeEnabled: enabled === true,
    ...(enabled && !agent.bridgeWorkspaceId
      ? { bridgeWorkspaceId: workspaces[0]?.id ?? null }
      : {}),
  });
};

/**
 * A bridge that failed to start cannot provide access, so access is switched off instead of
 * leaving an enabled switch in front of a dead bridge. A dropped socket does not come through
 * here: `useAgentBridge` retries that one by itself. Returns whether anything was switched off.
 */
export const disableAgentBridgeAfterFailure = (agent, workspaces = []) => {
  if (!agent?.id || !isAgentBridgeEnabled(agent)) return false;
  setAgentBridgeEnabled(agent, false, workspaces);
  return true;
};
