/**
 * Agents show their sessions grouped by workspace ("projects") in two places:
 * under the agent in `AgentList`, and under the agent in the Workspace section
 * (`WorkspaceList`). They are two separate views with their own headers, so each
 * keeps its own fold state: collapsing a project in one view leaves the same
 * project open in the other.
 *
 * The ids live in `interface_settings.collapsed_topics` next to the section ids,
 * and are keyed per workspace and agent: folding the Research project of one
 * agent leaves the Research project of another agent open.
 */

/** A project group in the Agents section. */
export const agentProjectCollapseId = (
  workspaceId: string,
  agentId: string,
) => `__agent_project__:${workspaceId}:${agentId}`;

/** A project group in the Workspace section's agent row. */
export const workspaceAgentCollapseId = (
  workspaceId: string,
  agentId: string,
) => `__workspace_agent__:${workspaceId}:${agentId}`;

/** The sessions an agent owns without attaching them to any workspace. */
export const unassignedAgentCollapseId = (agentId: string) =>
  `__agent_unassigned__:${agentId}`;
