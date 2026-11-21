import type { SyncNamespace } from "../types";
import { createAgentsNamespace } from "./agents";
import { createConversationsNamespace } from "./conversations";
import { createFoldersNamespace } from "./folders";
import { createSettingsNamespace } from "./settings";
import { createWorkspacesNamespace } from "./workspaces";

/**
 * One factory call per run: every namespace resets its per-run skipped and
 * conflict buffers when it is created.
 */
export function createDefaultNamespaces(): SyncNamespace[] {
  return [
    createSettingsNamespace(),
    createFoldersNamespace(),
    createWorkspacesNamespace(),
    createAgentsNamespace(),
    createConversationsNamespace(),
  ];
}
