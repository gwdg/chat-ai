// Pending confirmations for client-side MCP calls. A tool's execute waits here until the
// user accepts or denies the call in the chat; aborting the turn denies it as well.
export interface McpConfirmationRequest {
  id: string;
  server: string;
  tool: string;
  args: unknown;
}

type Pending = McpConfirmationRequest & {
  resolve: (allowed: boolean) => void;
  cleanup: () => void;
};

const pending = new Map<string, Pending>();
const listeners = new Set<() => void>();

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

function settle(id: string, allowed: boolean) {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  entry.cleanup();
  notify();
  entry.resolve(allowed);
}

export function resolveMcpConfirmation(id: string, allowed: boolean) {
  settle(id, allowed);
}

export function requestMcpConfirmation(
  request: McpConfirmationRequest,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const onAbort = () => settle(request.id, false);
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    pending.set(request.id, { ...request, resolve, cleanup });
    signal?.addEventListener("abort", onAbort, { once: true });
    notify();
  });
}
