import type { SyncNamespace } from "../types";
import { createAgentsNamespace } from "./agents";
import { createConversationsNamespace } from "./conversations";
import { createFoldersNamespace } from "./folders";
import { createInterfaceSettingsNamespace } from "./interfaceSettings";
import { createSettingsNamespace } from "./settings";
import { createWorkspacesNamespace } from "./workspaces";

/**
 * One factory call per run: every namespace resets its per-run skipped and
 * conflict buffers when it is created.
 *
 * Order matters for a restore: the account-wide settings and interface
 * preferences are applied before the records that refer to them.
 */
export function createDefaultNamespaces(): SyncNamespace[] {
  return [
    createSettingsNamespace(),
    createInterfaceSettingsNamespace(),
    createFoldersNamespace(),
    createWorkspacesNamespace(),
    createAgentsNamespace(),
    createConversationsNamespace(),
  ];
}
