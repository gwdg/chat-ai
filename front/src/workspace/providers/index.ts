import type { WorkspaceSourceRow } from "../../db/dbTypes";
import { ArcanaProvider } from "./arcana";
import { ArcanaFilesystemProvider } from "./arcanaFilesystem";
import { AgentFilesProvider } from "./agent";
import { BrowserProvider } from "./browser";
import { ConversationStorageProvider } from "./conversation";
import { workspaceBrowserStorageId } from "../browserStorage";
import { LocalProvider } from "./local";
import { McpProvider } from "./mcp";
import { ReadOnlyProvider } from "./readOnly";
import type { FileProvider } from "./types";

export function createProvider(source: WorkspaceSourceRow): FileProvider {
  let provider: FileProvider;
  if (source.kind === "browser") {
    // A workspace's browser sources share its own tree with its root, not with
    // the other workspaces.
    provider = new BrowserProvider(
      source.id,
      workspaceBrowserStorageId(source.workspaceId),
    );
  }
  else if (source.kind === "chat") {
    // The chat's own tree, mounted at /chats/<conversationId> (workspace/chatStorage.ts).
    provider = new ConversationStorageProvider(
      source.id,
      String((source.config as any)?.conversationId ?? ""),
    );
  }
  else if (source.kind === "local") {
    provider = new LocalProvider(
      source.id,
      String((source.config as any)?.handleKey || source.id),
      source.readOnly === true,
    );
  } else if (source.kind === "agent") {
    provider = new AgentFilesProvider(
      source.id,
      String((source.config as any)?.agentId ?? ""),
    );
  } else if (source.kind === "arcana") {
    provider = new ArcanaProvider(
      source.id,
      String((source.config as any)?.remoteWorkspaceId ?? ""),
    );
  } else if (source.kind === "arcana-filesystem") {
    provider = new ArcanaFilesystemProvider(source.id);
  } else {
    provider = new McpProvider(
      source.id,
      String((source.config as any)?.endpoint ?? ""),
      (source.config as any)?.transport === "sse" ? "sse" : "streamable-http",
      Array.isArray((source.config as any)?.toolAllowlist)
        ? (source.config as any).toolAllowlist
        : [],
    );
  }
  return source.readOnly ? new ReadOnlyProvider(provider) : provider;
}

export type { FileProvider } from "./types";
export { WorkspaceError } from "./types";
