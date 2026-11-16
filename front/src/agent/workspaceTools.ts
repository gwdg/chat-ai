// Workspace tools for a chat attached to a workspace. They cover what the ordinary file tools
// cannot see: every source of the workspace (mounted or not), its mounts, and the agents attached
// to it. The ordinary read/ls/find tools still work on the workspace root and its mounts.
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

import type {
  WorkspaceFileEntry,
  WorkspaceMountRow,
  WorkspaceRow,
  WorkspaceSourceRow,
} from "../db/dbTypes";
import type { FileProvider } from "../workspace/providers/types";
import type { Vfs } from "./vfs";

import { getAgents } from "../agents/agentStore";
import {
  getConversationWorkspaceIds,
  getWorkspaceAgentLinks,
  getWorkspaceAgentSessionIds,
  listWorkspaceMounts,
  listWorkspaceSources,
  listWorkspacesByIds,
} from "../db/workspaceDb";
import { DEVICE_PLANE_KINDS, getDeviceId } from "../workspace/deviceId";
import {
  baseName,
  isWithinPath,
  joinPath,
  normalizePath,
  parentPath,
} from "../workspace/paths";
import { createProvider } from "../workspace/providers";
import { createWorkspaceRootProvider } from "../workspace/workspaceRoot";

const text = (value: string): AgentToolResult<any> => ({
  content: [{ type: "text", text: value }],
  details: undefined,
});

type WorkspaceBundle = {
  workspace: WorkspaceRow;
  sources: WorkspaceSourceRow[];
  mounts: WorkspaceMountRow[];
  agentIds: string[];
};

export type WorkspaceToolSummary = {
  id: string;
  name: string;
  sourceCount: number;
  mountCount: number;
  agentIds: string[];
};

export type WorkspaceToolContext = {
  workspaceIds: string[];
  workspaces: WorkspaceToolSummary[];
};

type FileTarget = {
  /** `null` means the workspace root, which overlays the mounted folders. */
  source: WorkspaceSourceRow | null;
  /** Path inside that source, or a workspace path for the root. */
  path: string;
  /** The mount the path resolved through, when it did. */
  mount?: WorkspaceMountRow;
};

const toBytes = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      length += value.length;
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};

const streamOf = (data: Uint8Array | string) => {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
};

const availableOnThisDevice = (source: WorkspaceSourceRow) =>
  !DEVICE_PLANE_KINDS.has(source.kind) ||
  !source.deviceId ||
  source.deviceId === getDeviceId();

const agentLabel = (agent: any) => `${agent.name || agent.id} (${agent.id})`;

async function loadWorkspaces(workspaceIds: string[]): Promise<WorkspaceBundle[]> {
  const [rows, sources, mounts, links] = await Promise.all([
    listWorkspacesByIds(workspaceIds),
    listWorkspaceSources(workspaceIds),
    listWorkspaceMounts(workspaceIds),
    getWorkspaceAgentLinks(workspaceIds),
  ]);
  return rows.map((workspace) => ({
    workspace,
    sources: sources.filter((source) => source.workspaceId === workspace.id),
    mounts: mounts.filter((mount) => mount.workspaceId === workspace.id),
    agentIds: [
      ...new Set(
        links
          .filter((link) => link.workspaceId === workspace.id)
          .map((link) => link.agentId),
      ),
    ],
  }));
}

export async function createWorkspaceTools(
  conversationId: string,
  workspace: Vfs,
  primaryWorkspaceId?: string,
): Promise<{ tools: AgentTool<any>[]; context: WorkspaceToolContext }> {
  const workspaceIds = await getConversationWorkspaceIds(conversationId);
  const context: WorkspaceToolContext = { workspaceIds, workspaces: [] };
  if (!workspaceIds.length) return { tools: [], context };

  const bundles = await loadWorkspaces(workspaceIds);
  if (!bundles.length) return { tools: [], context };
  const agents = getAgents();
  context.workspaces = bundles.map(({ workspace: row, sources, mounts, agentIds }) => ({
    id: row.id,
    name: row.name,
    sourceCount: sources.length,
    mountCount: mounts.length,
    agentIds,
  }));

  const resolveWorkspace = (reference?: string) => {
    const target = String(reference || "").trim().toLowerCase();
    if (!target) return bundles[0] ?? null;
    return (
      bundles.find(
        ({ workspace: row }) =>
          row.id.toLowerCase() === target ||
          row.name.toLowerCase() === target,
      ) ?? null
    );
  };

  const workspaceNames = () =>
    bundles
      .map(({ workspace: row }) => `${row.name} (${row.id})`)
      .join(", ");

  const sourceNotFound = (bundle: WorkspaceBundle, reference: string) => {
    const choices = bundle.sources
      .map((source) => `${source.label} (${source.id})`)
      .join(", ");
    return `Source "${reference}" not found in ${bundle.workspace.name}. Available sources: ${choices || "none"}.`;
  };

  /** Whether the agent belongs to this workspace, through a link or a whole-workspace bridge. */
  const isAttached = (bundle: WorkspaceBundle, agent: any) =>
    bundle.agentIds.includes(agent.id) ||
    agent.bridgeWorkspaceId === bundle.workspace.id;

  const openSource = async (source: WorkspaceSourceRow) => {
    if (!availableOnThisDevice(source)) {
      throw new Error(
        `Source "${source.label}" belongs to another device and is unavailable here.`,
      );
    }
    const provider = createProvider(source);
    try {
      await provider.connect();
    } catch (error) {
      provider.close?.();
      throw error;
    }
    return provider;
  };

  const withProvider = async <T>(
    source: WorkspaceSourceRow,
    action: (provider: FileProvider) => Promise<T>,
  ) => {
    const provider = await openSource(source);
    try {
      return await action(provider);
    } finally {
      provider.close?.();
    }
  };

  const withRoot = async <T>(
    bundle: WorkspaceBundle,
    action: (provider: FileProvider) => Promise<T>,
  ) => {
    const provider: FileProvider = createWorkspaceRootProvider(
      bundle.workspace.id,
    );
    try {
      await provider.connect();
    } catch (error) {
      provider.close?.();
      throw error;
    }
    try {
      return await action(provider);
    } finally {
      provider.close?.();
    }
  };

  /** The mount that contains `path`, deepest first. */
  const bindingFor = (bundle: WorkspaceBundle, path: string) => {
    const normalized = normalizePath(path);
    let best:
      | { mount: WorkspaceMountRow; source: WorkspaceSourceRow; inner: string }
      | undefined;
    for (const mount of bundle.mounts) {
      const mountPath = normalizePath(mount.path);
      if (!isWithinPath(normalized, mountPath)) continue;
      const source = bundle.sources.find((item) => item.id === mount.sourceId);
      if (!source) continue;
      const relative =
        normalized === mountPath
          ? ""
          : normalized.slice(mountPath.length).replace(/^\/+/, "");
      const inner = joinPath(mount.sourcePath, relative);
      if (
        !best ||
        mountPath.length > normalizePath(best.mount.path).length
      ) {
        best = { mount, source, inner };
      }
    }
    return best;
  };

  /** A source named by id, label or mount path, for an explicit `source` argument. */
  const explicitTarget = (
    bundle: WorkspaceBundle,
    sourceReference: string,
    pathValue?: string,
  ): FileTarget | null => {
    const reference = String(sourceReference || "").trim();
    if (!reference) return null;
    const normalizedRef = normalizePath(reference);
    const mount = bundle.mounts.find(
      (item) => normalizePath(item.path) === normalizedRef,
    );
    if (mount) {
      const source = bundle.sources.find((item) => item.id === mount.sourceId);
      if (source) {
        const mountPath = normalizePath(mount.path);
        const normalizedPath = normalizePath(pathValue || "/");
        const relative = isWithinPath(normalizedPath, mountPath)
          ? normalizedPath.slice(mountPath.length).replace(/^\/+/, "")
          : String(pathValue || "").replace(/^\/+/, "");
        return {
          source,
          path: relative
            ? joinPath(mount.sourcePath, relative)
            : normalizePath(mount.sourcePath),
          mount,
        };
      }
    }
    const source =
      bundle.sources.find((item) => item.id === reference) ??
      bundle.sources.find(
        (item) => item.label.toLowerCase() === reference.toLowerCase(),
      );
    if (!source) return null;
    const normalizedPath = normalizePath(pathValue || "/");
    // A path expressed in workspace terms can still be read through its mount.
    const throughMount = bundle.mounts.find(
      (item) =>
        item.sourceId === source.id &&
        isWithinPath(normalizedPath, normalizePath(item.path)),
    );
    if (throughMount) {
      const mountPath = normalizePath(throughMount.path);
      const relative = normalizedPath
        .slice(mountPath.length)
        .replace(/^\/+/, "");
      return {
        source,
        path: joinPath(throughMount.sourcePath, relative),
        mount: throughMount,
      };
    }
    return { source, path: normalizedPath };
  };

  const resolveTarget = (
    bundle: WorkspaceBundle,
    sourceReference: string | undefined,
    pathValue: string | undefined,
  ): FileTarget | null => {
    if (String(sourceReference || "").trim()) {
      return explicitTarget(bundle, String(sourceReference), pathValue);
    }
    const binding = bindingFor(bundle, String(pathValue || "/"));
    if (binding) {
      return {
        source: binding.source,
        path: binding.inner,
        mount: binding.mount,
      };
    }
    return { source: null, path: normalizePath(pathValue || "/") };
  };

  /** Direct child names contributed by mounts below `path`. */
  const virtualMountNames = (bundle: WorkspaceBundle, path: string) => {
    const normalized = normalizePath(path);
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const names = new Set<string>();
    for (const mount of bundle.mounts) {
      const mountPath = normalizePath(mount.path);
      if (!mountPath.startsWith(prefix) || mountPath === normalized) continue;
      const first = mountPath.slice(prefix.length).split("/")[0];
      if (first) names.add(first);
    }
    return names;
  };

  const formatEntry = (entry: WorkspaceFileEntry, displayPath: string) => {
    const size =
      typeof entry.size === "number" ? ` (${entry.size} bytes)` : "";
    const children =
      entry.kind === "dir" && typeof entry.childCount === "number"
        ? `, ${entry.childCount} entries`
        : "";
    const mime = entry.kind === "file" && entry.mime ? `, ${entry.mime}` : "";
    const mtime = entry.mtime ? ` — ${entry.mtime}` : "";
    return `${entry.kind === "dir" ? "dir " : "file"} ${displayPath}${size}${children}${mime}${mtime}`;
  };

  const listPath = async (bundle: WorkspaceBundle, path: string) => {
    const normalized = normalizePath(path);
    const binding = bindingFor(bundle, normalized);
    if (binding) {
      const page = await withProvider(binding.source, (provider) =>
        provider.list(binding.inner),
      );
      return {
        header: `Listing ${normalized} from ${binding.source.label}${binding.inner !== "/" ? ` (${binding.inner})` : ""}.`,
        lines: page.entries.map((entry) =>
          formatEntry(entry, joinPath(normalized, entry.name)),
        ),
        hasMore: Boolean(page.next),
      };
    }
    let lines: string[] = [];
    let hasMore = false;
    const seen = new Set<string>();
    try {
      const page = await withRoot(bundle, (provider) =>
        provider.list(normalized),
      );
      lines = page.entries.map((entry) => {
        seen.add(entry.name);
        return formatEntry(entry, joinPath(normalized, entry.name));
      });
      hasMore = Boolean(page.next);
    } catch {
      // The root can be empty or unreachable while mounted folders still exist.
    }
    for (const name of virtualMountNames(bundle, normalized)) {
      if (seen.has(name)) continue;
      lines.push(`dir  ${joinPath(normalized, name)}  (mounted folder)`);
    }
    return {
      header: `Listing ${normalized} in ${bundle.workspace.name}.`,
      lines,
      hasMore,
    };
  };

  const readTarget = async (bundle: WorkspaceBundle, target: FileTarget) => {
    if (target.source) {
      const bytes = await withProvider(target.source, async (provider) =>
        toBytes(await provider.read(target.path)),
      );
      return bytes;
    }
    return withRoot(bundle, async (provider) =>
      toBytes(await provider.read(target.path)),
    );
  };

  const writeTarget = async (
    bundle: WorkspaceBundle,
    target: FileTarget,
    data: Uint8Array | string,
  ) => {
    if (target.mount?.readOnly) throw new Error("That mount is read-only.");
    if (target.source) {
      if (target.source.readOnly || !target.source.capabilities?.write) {
        throw new Error(`Source "${target.source.label}" is read-only.`);
      }
      await withProvider(target.source, async (provider) => {
        const directory = parentPath(target.path);
        if (
          directory !== "/" &&
          target.source?.capabilities?.mkdir &&
          provider.mkdir
        ) {
          await provider.mkdir(directory).catch(() => {});
        }
        await provider.write(target.path, streamOf(data), { overwrite: true });
      });
      return;
    }
    if (primaryWorkspaceId && bundle.workspace.id === primaryWorkspaceId) {
      const directory = parentPath(target.path);
      if (directory !== "/") await workspace.mkdir(directory).catch(() => {});
      await workspace.writeFile(target.path, data);
      return;
    }
    await withRoot(bundle, async (provider) => {
      const directory = parentPath(target.path);
      if (directory !== "/") await provider.mkdir(directory).catch(() => {});
      await provider.write(target.path, streamOf(data), { overwrite: true });
    });
  };

  const listTool: AgentTool<any> = {
    name: "workspace_list",
    label: "List workspaces",
    description:
      "List the workspaces attached to this chat with their sources, mounted folders and agents. Use it before asking about a workspace's files or agents.",
    parameters: Type.Object({
      workspace: Type.Optional(
        Type.String({
          description: "Workspace id or name; defaults to every attached workspace",
        }),
      ),
    }),
    execute: async (_id, args) => {
      const selected = args.workspace
        ? [resolveWorkspace(args.workspace)].filter(Boolean)
        : bundles;
      if (!selected.length) {
        return text(`Workspace not found. Attached workspaces: ${workspaceNames()}.`);
      }
      const lines: string[] = [`Workspaces attached to this chat:`];
      for (const bundle of selected as WorkspaceBundle[]) {
        const { workspace: row, sources, mounts } = bundle;
        lines.push(``, `Workspace: ${row.name} (${row.id})`);
        lines.push(`  Sources:`);
        if (!sources.length) lines.push("  (none)");
        for (const source of sources) {
          const flags = [
            source.readOnly ? "read-only" : "",
            availableOnThisDevice(source)
              ? ""
              : "unavailable on this device",
          ]
            .filter(Boolean)
            .join(", ");
          lines.push(
            `  - ${source.label} (${source.kind}, id: ${source.id})${flags ? ` — ${flags}` : ""}`,
          );
        }
        lines.push(`  Mounts:`);
        if (!mounts.length) {
          lines.push("  (none; files are kept in the workspace root)");
        }
        for (const mount of mounts) {
          const source = sources.find((item) => item.id === mount.sourceId);
          lines.push(
            `  - ${normalizePath(mount.path)} → ${source?.label ?? mount.sourceId}:${normalizePath(mount.sourcePath)}${mount.readOnly ? " (read-only)" : ""}`,
          );
        }
        const attached = agents.filter((agent) => isAttached(bundle, agent));
        lines.push(`  Agents:`);
        if (!attached.length) {
          lines.push("  (none attached)");
        } else {
          for (const agent of attached) {
            lines.push(`  - ${agentLabel(agent)}`);
          }
        }
        const others = agents.length - attached.length;
        if (others > 0) {
          lines.push(
            `  ${others} other configured agent(s) are not attached and are not accessible from this chat.`,
          );
        }
      }
      lines.push(
        ``,
        "Use workspace_files to browse the workspace root, a mount, or a source that is not mounted, and workspace_list_agents for the agents of each workspace.",
      );
      return text(lines.join("\n"));
    },
  };

  const agentsTool: AgentTool<any> = {
    name: "workspace_list_agents",
    label: "List workspace agents",
    description:
      "List the agents attached to the workspaces of this chat, with their ids, active session and how many sessions are attached to each workspace. Other configured agents that are not attached are listed separately and are not accessible.",
    parameters: Type.Object({
      workspace: Type.Optional(
        Type.String({
          description: "Workspace id or name; defaults to every attached workspace",
        }),
      ),
    }),
    execute: async (_id, args) => {
      const selected = args.workspace
        ? [resolveWorkspace(args.workspace)].filter(Boolean)
        : bundles;
      if (!selected.length) {
        return text(`Workspace not found. Attached workspaces: ${workspaceNames()}.`);
      }
      const lines: string[] = [];
      for (const bundle of selected as WorkspaceBundle[]) {
        const attached = agents.filter((agent) => isAttached(bundle, agent));
        lines.push(
          `Workspace: ${bundle.workspace.name} (${bundle.workspace.id})`,
        );
        if (!attached.length) {
          lines.push("Attached agents: none");
        } else {
          lines.push("Attached agents:");
          for (const agent of attached) {
            let sessions = 0;
            if (bundle.agentIds.includes(agent.id)) {
              sessions = (
                await getWorkspaceAgentSessionIds(
                  bundle.workspace.id,
                  agent.id,
                ).catch(() => [])
              ).length;
            }
            const bridged =
              agent.bridgeWorkspaceId === bundle.workspace.id &&
              !bundle.agentIds.includes(agent.id)
                ? ", bridged to this workspace"
                : "";
            lines.push(
              `- ${agentLabel(agent)}: active session ${agent.sessionId || "none"}, ${sessions} session(s) attached${bridged}`,
            );
          }
        }
        const others = agents.filter((agent) => !isAttached(bundle, agent));
        if (others.length) {
          lines.push(
            `Other configured agents (not attached; not accessible from this chat): ${others.map(agentLabel).join(", ")}`,
          );
        }
        lines.push("");
      }
      return text(lines.join("\n").trim() || "No agents are configured.");
    },
  };

  const filesTool: AgentTool<any> = {
    name: "workspace_files",
    label: "List workspace files",
    description:
      "List a folder in a workspace attached to this chat. Without `source` it lists the workspace root and its mounted folders; pass `source` to browse a source that is not mounted. Source can be a source id, a source label or a mount path.",
    parameters: Type.Object({
      workspace: Type.Optional(
        Type.String({ description: "Workspace id or name; defaults to the first attached workspace" }),
      ),
      source: Type.Optional(
        Type.String({ description: "Source id, label or mount path" }),
      ),
      path: Type.Optional(
        Type.String({ description: "Folder path, default /" }),
      ),
    }),
    execute: async (_id, args) => {
      const bundle = resolveWorkspace(args.workspace);
      if (!bundle) {
        return text(`Workspace not found. Attached workspaces: ${workspaceNames()}.`);
      }
      const pathValue = String(args.path || "/");
      try {
        if (args.source) {
          const target = explicitTarget(bundle, args.source, pathValue);
          if (!target?.source) {
            const choices = bundle.sources
              .map((source) => `${source.label} (${source.id})`)
              .join(", ");
            return text(
              `Source not found. Sources of ${bundle.workspace.name}: ${choices || "none"}.`,
            );
          }
          const page = await withProvider(target.source, (provider) =>
            provider.list(target.path),
          );
          const header = `Listing ${normalizePath(target.path)} in ${target.source.label} (${bundle.workspace.name}).`;
          const lines = page.entries.map((entry) =>
            formatEntry(entry, entry.name),
          );
          return text(
            [header, ...(lines.length ? lines : ["(empty folder)"]), page.next ? "(more entries available)" : ""]
              .filter(Boolean)
              .join("\n"),
          );
        }
        const result = await listPath(bundle, pathValue);
        return text(
          [
            result.header,
            ...(result.lines.length ? result.lines : ["(empty folder)"]),
            result.hasMore ? "(more entries available)" : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      } catch (error) {
        return text(
          `Could not list workspace files: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const readTool: AgentTool<any> = {
    name: "workspace_read_file",
    label: "Read workspace file",
    description:
      "Read a UTF-8 file from a workspace attached to this chat, including files in sources that are not mounted. Pass `source` (id, label or mount path) for a source outside the workspace root.",
    parameters: Type.Object({
      workspace: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      path: Type.String({ description: "File path" }),
      maxChars: Type.Optional(Type.Number()),
    }),
    execute: async (_id, args) => {
      const bundle = resolveWorkspace(args.workspace);
      if (!bundle) {
        return text(`Workspace not found. Attached workspaces: ${workspaceNames()}.`);
      }
      const pathValue = String(args.path || "").trim();
      if (!pathValue) return text("A file path is required.");
      const maxChars = Math.min(
        100000,
        Math.max(1, Number(args.maxChars) || 20000),
      );
      try {
        const target = resolveTarget(bundle, args.source, pathValue);
        if (!target) return text(sourceNotFound(bundle, String(args.source)));
        const bytes = await readTarget(bundle, target);
        if (bytes.length > 2 * 1024 * 1024) {
          return text(`File is too large to read (${bytes.length} bytes).`);
        }
        if (bytes.includes(0)) {
          return text(
            `File appears to be binary (${bytes.length} bytes). Use workspace_fetch_file to attach it.`,
          );
        }
        const value = new TextDecoder().decode(bytes);
        return text(value.slice(0, maxChars) || "(empty file)");
      } catch (error) {
        return text(
          `Could not read workspace file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const writeTool: AgentTool<any> = {
    name: "workspace_write_file",
    label: "Write workspace file",
    description:
      "Write a UTF-8 file in a workspace attached to this chat. Pass `source` (id, label or mount path) to write into a source outside the workspace root; read-only sources and mounts reject the write.",
    parameters: Type.Object({
      workspace: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      path: Type.String({ description: "File path" }),
      content: Type.String({ description: "Full file content" }),
    }),
    execute: async (_id, args) => {
      const bundle = resolveWorkspace(args.workspace);
      if (!bundle) {
        return text(`Workspace not found. Attached workspaces: ${workspaceNames()}.`);
      }
      const pathValue = String(args.path || "").trim();
      if (!pathValue) return text("A file path is required.");
      try {
        const target = resolveTarget(bundle, args.source, pathValue);
        if (!target) return text(sourceNotFound(bundle, String(args.source)));
        await writeTarget(bundle, target, String(args.content ?? ""));
        return text(`Wrote ${normalizePath(pathValue)} in ${bundle.workspace.name}.`);
      } catch (error) {
        return text(
          `Could not write workspace file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const fetchTool: AgentTool<any> = {
    name: "workspace_fetch_file",
    label: "Fetch workspace file",
    description:
      "Copy any file, including images and PDFs, from a workspace attached to this chat into this chat as an attachment. Pass `source` (id, label or mount path) for a source outside the workspace root.",
    parameters: Type.Object({
      workspace: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
      path: Type.String({ description: "File path" }),
    }),
    execute: async (_id, args) => {
      const bundle = resolveWorkspace(args.workspace);
      if (!bundle) {
        return text(`Workspace not found. Attached workspaces: ${workspaceNames()}.`);
      }
      const pathValue = String(args.path || "").trim();
      if (!pathValue) return text("A file path is required.");
      try {
        const target = resolveTarget(bundle, args.source, pathValue);
        if (!target) return text(sourceNotFound(bundle, String(args.source)));
        const bytes = await readTarget(bundle, target);
        if (bytes.length > 20 * 1024 * 1024) {
          return text(`File is too large to attach (${bytes.length} bytes).`);
        }
        const name = baseName(pathValue) || "file";
        const safeWorkspace =
          bundle.workspace.name
            .replace(/[^a-z0-9._-]+/gi, "-")
            .replace(/^-+|-+$/g, "") || "workspace";
        const destination = `/workspace-files/${safeWorkspace}/${name}`;
        const directory =
          destination.slice(0, destination.lastIndexOf("/")) || "/";
        await workspace.mkdir(directory).catch(() => {});
        await workspace.writeFile(destination, bytes);
        return text(
          `Attached ${destination} from ${bundle.workspace.name} (${bytes.length} bytes).`,
        );
      } catch (error) {
        return text(
          `Could not fetch workspace file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  return {
    tools: [listTool, agentsTool, filesTool, readTool, writeTool, fetchTool],
    context,
  };
}
