// Pending confirmations for client-side MCP calls. A tool's execute waits here until the
// user accepts or denies the call in the chat; aborting the turn denies it as well.
export interface McpConfirmationRequest {
  id: string;
  server: string;
  tool: string;
  /** The name the model uses for this tool, for marking calls that are always allowed. */
  callName?: string;
  args: unknown;
}

type Pending = McpConfirmationRequest & {
  resolve: (allowed: boolean) => void;
  cleanup: () => void;
};

const pending = new Map<string, Pending>();
const listeners = new Set<() => void>();
// "Always" grants for the current conversation, per MCP server and tool/function name.
const alwaysAllowed = new Set<string>();
// Model-facing tool names covered by the current grants, so the transcript can mark them.
const alwaysAllowedNames = new Set<string>();
let sessionConversation: string | null = null;
const grantKey = (request: McpConfirmationRequest) =>
  `${request.server}\u0000${request.tool}`;

const notify = () => {
  for (const listener of listeners) listener();
};

export function subscribeMcpConfirmations(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMcpConfirmation(id: string): McpConfirmationRequest | undefined {
  return pending.get(id);
}

export function isMcpConfirmationAlwaysAllowed(callName: string | undefined) {
  return !!callName && alwaysAllowedNames.has(callName);
}

function settle(id: string, allowed: boolean) {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  entry.cleanup();
  notify();
  entry.resolve(allowed);
}

export function resolveMcpConfirmation(id: string, allowed: boolean, always = false) {
  const entry = pending.get(id);
  if (allowed && always && entry) {
    const key = grantKey(entry);
    alwaysAllowed.add(key);
    if (entry.callName) alwaysAllowedNames.add(entry.callName);
    // Calls of the same tool that are already waiting are covered by this grant as well.
    for (const [pendingId, request] of [...pending]) {
      if (grantKey(request) === key) settle(pendingId, true);
    }
    return;
  }
  settle(id, allowed);
}

/** Forgets "always" grants when the conversation changes. */
export function beginMcpConfirmationSession(conversationId: string | undefined) {
  const next = conversationId ?? null;
  if (next === sessionConversation) return;
  sessionConversation = next;
  alwaysAllowed.clear();
  alwaysAllowedNames.clear();
  notify();
}

/** Forgets all "always" grants, including the current conversation. */
export function resetMcpConfirmationSession() {
  sessionConversation = null;
  alwaysAllowed.clear();
  alwaysAllowedNames.clear();
  notify();
}

export function requestMcpConfirmation(
  request: McpConfirmationRequest,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  if (alwaysAllowed.has(grantKey(request))) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onAbort = () => settle(request.id, false);
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    pending.set(request.id, { ...request, resolve, cleanup });
    signal?.addEventListener("abort", onAbort, { once: true });
    notify();
  });
}
