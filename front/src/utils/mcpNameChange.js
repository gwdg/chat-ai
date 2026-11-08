import { normalizeMcpUrl } from "../agent/mcp";

/**
 * Asks the user whether to connect to an MCP server whose reported name differs from the
 * stored one. Confirming updates the stored name in the conversation settings.
 * Resolves to whether the user accepted.
 */
export function confirmMcpNameChange({
  openModal,
  setLocalState,
  conversationId,
  server,
  actualName,
}) {
  return new Promise((resolve) => {
    openModal("mcpNameChange", {
      serverUrl: server.url,
      previousName: server.name,
      actualName,
      onConfirm: () => {
        setLocalState((prev) => {
          if (prev.id !== conversationId) return prev;
          const servers = prev.settings?.mcp_servers;
          if (!Array.isArray(servers)) return prev;
          return {
            ...prev,
            settings: {
              ...prev.settings,
              mcp_servers: servers.map((entry) =>
                entry?.url && normalizeMcpUrl(entry.url) === server.url
                  ? { ...entry, name: actualName }
                  : entry,
              ),
            },
            flush: true,
          };
        });
        resolve(true);
      },
      onCancel: () => resolve(false),
    });
  });
}
