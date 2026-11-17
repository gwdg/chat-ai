import type { WorkspaceFileEntry, WorkspaceSourceRow } from "../db/dbTypes";
import {
  addWorkspaceMount,
  attachWorkspaceChat,
  listWorkspaceMounts,
  listWorkspaceSources,
} from "../db/workspaceDb";
import { createProvider } from "./providers";
import { ConversationStorageProvider } from "./providers/conversation";
import type { FileProvider } from "./providers/types";
import { runTransfer } from "./transfer";
import { createWorkspaceRootProvider } from "./workspaceRoot";

export type WorkspaceSelection = {
  sourceId: string;
  sourceKind: "local" | "chat" | "arcana-filesystem" | "arcana";
  /** Provider path; "/" means the source (or chat) root. */
  path: string;
  name: string;
  kind: "dir" | "file";
  /** Chat entries only. */
  conversationId?: string;
  /** Display name to mount under, defaults to `name`. */
  title?: string;
};

const mountSegment = (value: string): string => {
  const text = String(value ?? "")
    .replace(/[\\/]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "")
    .slice(0, 120);
  return text && text !== "." && text !== ".." ? text : "Untitled";
};

const isChatRoot = (selection: WorkspaceSelection): boolean =>
  selection.sourceKind === "chat" &&
  selection.path === "/" &&
  Boolean(selection.conversationId);

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : String(error);

export async function addSelectionToWorkspace(
  workspaceId: string,
  selection: WorkspaceSelection[],
  options: { onProgress?: (done: number, total: number) => void } = {},
): Promise<{
  mounted: number;
  copied: number;
  failed: { name: string; error: string }[];
}> {
  const total = selection.length;
  const failed: { name: string; error: string }[] = [];
  let mounted = 0;
  let copied = 0;
  let done = 0;

  const takenPaths = new Set<string>();
  try {
    for (const mount of await listWorkspaceMounts([workspaceId])) {
      takenPaths.add(mount.path);
    }
  } catch {
    // Without the mount list, collisions are only tracked within this batch.
  }
  let sources: Promise<WorkspaceSourceRow[]> | null = null;
  const loadSources = () =>
    (sources ??= listWorkspaceSources([workspaceId]));
  let rootProvider: FileProvider | null = null;
  const getRootProvider = () => {
    rootProvider ??= createWorkspaceRootProvider(workspaceId);
    return rootProvider;
  };

  const rootNames = new Set<string>();
  try {
    const root = getRootProvider();
    if (root.status !== "connected") await root.connect();
    const page = await root.list("/");
    for (const entry of page.entries) rootNames.add(entry.name);
  } catch {
    // The workspace root may not be readable yet; mounts alone still avoid collisions.
  }

  const uniqueMountPath = (selection: WorkspaceSelection): string => {
    const base = mountSegment(selection.title || selection.name);
    const taken = (path: string) =>
      takenPaths.has(path) || rootNames.has(path.slice(1));
    let candidate = `/${base}`;
    for (let suffix = 2; taken(candidate); suffix += 1) {
      candidate = `/${base} (${suffix})`;
    }
    takenPaths.add(candidate);
    return candidate;
  };

  const connectIfNeeded = async (provider: FileProvider) => {
    if (provider.status !== "connected") await provider.connect();
  };

  const providerFor = async (
    selection: WorkspaceSelection,
  ): Promise<FileProvider> => {
    if (selection.sourceKind === "chat") {
      return new ConversationStorageProvider(
        `chat-selection:${selection.conversationId ?? selection.sourceId}`,
        String(selection.conversationId ?? ""),
      );
    }
    const source = (await loadSources()).find(
      (row) => row.id === selection.sourceId,
    );
    if (!source) throw new Error(`Source not found: ${selection.sourceId}`);
    return createProvider(source);
  };

  for (const item of selection) {
    try {
      if (item.kind === "dir" && isChatRoot(item)) {
        await attachWorkspaceChat(workspaceId, item.conversationId!);
        mounted += 1;
      } else if (
        item.kind === "dir" &&
        (item.sourceKind === "local" ||
          item.sourceKind === "arcana-filesystem" ||
          item.sourceKind === "arcana")
      ) {
        await addWorkspaceMount({
          workspaceId,
          sourceId: item.sourceId,
          sourcePath: item.path,
          path: uniqueMountPath(item),
        });
        mounted += 1;
      } else {
        const from = await providerFor(item);
        await connectIfNeeded(from);
        const to = getRootProvider();
        await connectIfNeeded(to);
        const entry: WorkspaceFileEntry = {
          sourceId: from.sourceId,
          path: item.path,
          name: item.name,
          kind: item.kind,
        };
        await runTransfer({
          workspaceId,
          from,
          to,
          entry,
          targetDir: "/",
          strategy: "copy",
        });
        copied += 1;
      }
    } catch (error) {
      failed.push({ name: item.name, error: errorMessage(error) });
    } finally {
      done += 1;
      options.onProgress?.(done, total);
    }
  }

  return { mounted, copied, failed };
}
