/**
 * Agents show their sessions grouped by workspace ("projects") in two places:
 * under the agent in `AgentList`, and under the agent in the Workspace section
 * (`WorkspaceList`). Both render the same sessions, so they share one fold state.
 *
 * The ids live in `interface_settings.collapsed_topics` next to the section ids,
 * and are keyed per workspace and agent: folding the Research project of one
 * agent leaves the Research project of another agent open.
 */
export const workspaceAgentCollapseId = (
  workspaceId: string,
  agentId: string,
) => `__workspace_agent__:${workspaceId}:${agentId}`;

/** The sessions an agent owns without attaching them to any workspace. */
export const unassignedAgentCollapseId = (agentId: string) =>
  `__agent_unassigned__:${agentId}`;
