import { updateAgent } from "./agentStore";

/**
 * Agent workspace access is explicit, with one exception for existing data: agents that already
 * had an active bridge workspace keep their access on. New agents start without it.
 */
export const isAgentBridgeEnabled = (agent) =>
  agent?.bridgeEnabled ?? !!agent?.bridgeWorkspaceId;

/**
 * The workspaces an agent is actually attached to, in sidebar order.
 *
 * `workspace_agents` is the only source of truth here: `bridgeWorkspaceId` remembers a choice
 * but is not an attachment, so it cannot put a workspace on this list by itself.
 */
export const attachedWorkspaces = (workspaces = [], links = []) => {
  if (!workspaces?.length || !links?.length) return [];
  const ids = new Set(links.map((link) => link.workspaceId));
  return workspaces.filter((workspace) => ids.has(workspace.id));
};

/**
 * The workspace the bridge exposes: the remembered choice while it is still attached, otherwise
 * the first attached one, otherwise `null`.
 *
 * Only an attached workspace may be exposed. Falling back to "any workspace of this account"
 * would hand the agent files the user never connected to this agent; with nothing attached the
 * result is `null`, and the bridge then does not start at all.
 */
export const resolveBridgeWorkspace = (agent, attachedWorkspaces = []) => {
  const attached = attachedWorkspaces || [];
  return (
    attached.find((workspace) => workspace.id === agent?.bridgeWorkspaceId) ??
    attached[0] ??
    null
  );
};

/**
 * Switch access on or off. The workspace is chosen by attaching it (the first attached one is
 * used until another is selected), so this never invents a workspace of its own: an agent with
 * nothing attached cannot start a bridge.
 */
export const setAgentBridgeEnabled = (agent, enabled) => {
  if (!agent?.id) return;
  updateAgent(agent.id, { bridgeEnabled: enabled === true });
};

/**
 * A bridge that failed to start cannot provide access, so access is switched off instead of
 * leaving an enabled switch in front of a dead bridge. A dropped socket does not come through
 * here: `useAgentBridge` retries that one by itself. Returns whether anything was switched off.
 */
export const disableAgentBridgeAfterFailure = (agent) => {
  if (!agent?.id || !isAgentBridgeEnabled(agent)) return false;
  setAgentBridgeEnabled(agent, false);
  return true;
};
