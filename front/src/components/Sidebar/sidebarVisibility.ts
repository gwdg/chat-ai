/**
 * Visibility gate for the advanced sidebar sections.
 *
 * Advanced mode is the user-facing switch and is off by default. The Agents and
 * Arcanas module flags stay authoritative for their lists, so deployments that
 * disable a module never show its section even when advanced mode is on.
 */
export function showAdvancedSidebarSections(
  advancedMode: boolean,
  agentsEnabled: boolean,
  arcanasEnabled: boolean,
): { agents: boolean; mcpServers: boolean; arcanas: boolean } {
  return {
    agents: Boolean(advancedMode && agentsEnabled),
    mcpServers: Boolean(advancedMode),
    arcanas: Boolean(advancedMode && arcanasEnabled),
  };
}
