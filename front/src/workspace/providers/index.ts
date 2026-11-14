import type { WorkspaceSourceRow } from "../../db/dbTypes";
import { ArcanaProvider } from "./arcana";
import { BrowserProvider } from "./browser";
import { LocalProvider } from "./local";
import { McpProvider } from "./mcp";
import type { FileProvider } from "./types";

export function createProvider(source: WorkspaceSourceRow): FileProvider {
  if (source.kind === "browser") return new BrowserProvider(source.id);
  if (source.kind === "local") {
    return new LocalProvider(
      source.id,
      String((source.config as any)?.handleKey || source.id),
    );
  }
  if (source.kind === "arcana") {
    return new ArcanaProvider(
      source.id,
      String((source.config as any)?.remoteWorkspaceId ?? ""),
    );
  }
  return new McpProvider(
    source.id,
    String((source.config as any)?.endpoint ?? ""),
    (source.config as any)?.transport === "sse" ? "sse" : "streamable-http",
    Array.isArray((source.config as any)?.toolAllowlist)
      ? (source.config as any).toolAllowlist
      : [],
  );
}

export type { FileProvider } from "./types";
export { WorkspaceError } from "./types";
