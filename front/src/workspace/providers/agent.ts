import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../../db/dbTypes";
import { getAgent } from "../../agents/agentStore";
import {
  getOpencodeInfo,
  listOpencodeFiles,
  readOpencodeFile,
} from "../../apis/opencodeAgents";
import { defaultCapabilities } from "../capabilities";
import { baseName, normalizePath, parentPath } from "../paths";
import type { DirectoryPage, FileProvider } from "./types";
import { WorkspaceError } from "./types";

const agentPath = (path: string) =>
  normalizePath(path).replace(/^\/+/, "");

const timeValue = (item: any) => {
  const raw =
    item?.mtime ??
    item?.modified ??
    item?.modifiedAt ??
    item?.time?.modified ??
    item?.time?.updated ??
    item?.time?.created ??
    item?.createdAt;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : new Date(raw).getTime();
  if (!Number.isFinite(value)) return undefined;
  return new Date(value < 1e12 ? value * 1000 : value).toISOString();
};

export class AgentFilesProvider implements FileProvider {
  readonly kind = "agent" as const;
  readonly capabilities: WorkspaceCapabilities = defaultCapabilities("agent");
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";

  constructor(
    readonly sourceId: string,
    readonly agentId: string,
  ) {}

  private agent() {
    const agent = getAgent(this.agentId);
    if (!agent) {
      throw new WorkspaceError("NOT_FOUND", "Agent is not configured");
    }
    return agent;
  }

  async connect() {
    try {
      await getOpencodeInfo(this.agent());
      this.status = "connected";
    } catch (error) {
      this.status = "error";
      throw error;
    }
  }

  private entry(item: any): WorkspaceFileEntry {
    const path = normalizePath(String(item?.path || ""));
    const name =
      String(item?.name || "").trim() || baseName(path) || path || "/";
    return {
      sourceId: this.sourceId,
      path,
      name,
      kind: item?.type === "directory" ? "dir" : "file",
      size: typeof item?.size === "number" ? item.size : undefined,
      mtime: timeValue(item),
      mime: item?.mime || item?.contentType || undefined,
      childCount:
        typeof item?.childCount === "number" ? item.childCount : undefined,
    };
  }

  async list(path: string): Promise<DirectoryPage> {
    const normalized = normalizePath(path);
    const rows = await listOpencodeFiles(this.agent(), agentPath(normalized));
    return {
      entries: (Array.isArray(rows) ? rows : [])
        .map((row: any) => this.entry(row))
        .filter((entry: WorkspaceFileEntry) => entry.path !== "/"),
    };
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    const rows = await listOpencodeFiles(
      this.agent(),
      agentPath(parentPath(normalized)),
    );
    const name = baseName(normalized);
    const match = (Array.isArray(rows) ? rows : [])
      .map((row: any) => this.entry(row))
      .find(
        (entry: WorkspaceFileEntry) =>
          entry.path === normalized || entry.name === name,
      );
    if (!match) throw new WorkspaceError("NOT_FOUND", normalized);
    return match;
  }

  async read(path: string, range?: { start: number; end: number }) {
    const normalized = normalizePath(path);
    const { blob } = await readOpencodeFile(this.agent(), agentPath(normalized));
    const data = range ? blob.slice(range.start, range.end) : blob;
    return data.stream();
  }

  async write() {
    throw new WorkspaceError("PERMISSION_DENIED", "Agent files are read-only");
  }

  async mkdir() {
    throw new WorkspaceError("PERMISSION_DENIED", "Agent files are read-only");
  }

  async remove() {
    throw new WorkspaceError("PERMISSION_DENIED", "Agent files are read-only");
  }
}
