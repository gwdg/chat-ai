/**
 * A streamable-HTTP MCP session is server-side state.
 *
 * The transport keeps the `mcp-session-id` the server handed out during
 * `initialize` and sends it with every later request. The service forgets that
 * id when its process restarts, when the session idles out, or when a client is
 * moved to another instance behind a load balancer. It then answers `404` with a
 * JSON-RPC error whose message names the session, and the SDK keeps sending the
 * dead id: it only clears it on an explicit `DELETE`, never because a request
 * was rejected.
 *
 * The SAIA services (saia-fs, saia-rag) are long-lived sources kept open by the
 * workspace browser, so a restart of one of them made the drive report
 * `Session not found` until the page was reloaded. Both providers therefore
 * reconnect once and repeat the same call on this error.
 *
 * The text comes from the service's own wording, not from a status code alone:
 * a `404` for a wrong endpoint must stay a normal failure.
 */
const SESSION_LOST = [
  /session\s+(?:id\s+)?(?:not\s+found|expired|unknown|invalid|terminated|ended|closed|gone)/i,
  /(?:unknown|invalid|expired|stale|missing|no)\s+(?:valid\s+|active\s+)?session/i,
  /session\s+has\s+(?:expired|ended|been\s+(?:closed|terminated|removed))/i,
  /rejected\s+request\s+with\s+(?:an\s+)?unknown\s+or\s+expired\s+session/i,
];

/**
 * Whether an MCP failure means "this session id is no longer valid", which a
 * fresh handshake repairs.
 */
export function isStaleMcpSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return false;
  return SESSION_LOST.some((pattern) => pattern.test(message));
}
