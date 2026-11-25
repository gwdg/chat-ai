/**
 * Visibility gate for the advanced sidebar sections.
 *
 * Advanced mode is the user-facing switch and is off by default. The Agents
 * module flag stays authoritative for the Agents list, so deployments that
 * disable it never show agents even when advanced mode is on.
 */
export function showAdvancedSidebarSections(
  advancedMode: boolean,
  agentsEnabled: boolean,
): { agents: boolean; mcpServers: boolean } {
  return {
    agents: Boolean(advancedMode && agentsEnabled),
    mcpServers: Boolean(advancedMode),
  };
}
