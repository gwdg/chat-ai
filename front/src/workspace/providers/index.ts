import type { WorkspaceSourceRow } from "../../db/dbTypes";
import { ArcanaProvider } from "./arcana";
import { ArcanaFilesystemProvider } from "./arcanaFilesystem";
import { BrowserProvider } from "./browser";
import { SHARED_BROWSER_STORAGE_ID } from "../browserStorage";
import { LocalProvider } from "./local";
import { McpProvider } from "./mcp";
import { ReadOnlyProvider } from "./readOnly";
import type { FileProvider } from "./types";

export function createProvider(source: WorkspaceSourceRow): FileProvider {
  let provider: FileProvider;
  if (source.kind === "browser") {
    provider = new BrowserProvider(source.id, SHARED_BROWSER_STORAGE_ID);
  }
  else if (source.kind === "local") {
    provider = new LocalProvider(
      source.id,
      String((source.config as any)?.handleKey || source.id),
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
