import { hashPayload } from "../canonical";
import type { ApplyContext, LocalRecord, RemoteRecord, SyncNamespace } from "../types";
import {
  applyWorkspaceBundle,
  deleteWorkspaceForSync,
  listWorkspaceBundlesForSync,
  readWorkspaceTreeFile,
} from "../../db/syncAdapters";
import type { WorkspaceBundleForSync } from "../../db/syncAdapters";
import { AssetCollector } from "./assets";

/**
 * A workspace is one record: its row, its sources, mounts, chat and agent
 * links, and the shape of its own browser tree. File contents travel as
 * content-addressed assets, so two workspaces that share a file share one
 * uploaded blob.
 *
 * The tree is applied additively. A file the record does not carry (because it
 * was too large to upload, or because it was added on this device after the
 * last sync) is never deleted by a pull; only an explicit workspace delete is.
 */
const CONFLICT_SUFFIX = " (conflict copy)";

const serialize = async (bundle: WorkspaceBundleForSync) => {
  const collector = new AssetCollector();
  const skipped: string[] = [];
  const tree: any[] = [];
  for (const entry of bundle.tree) {
    if (entry.kind === "dir") {
      tree.push({ path: entry.path, kind: "dir" });
      continue;
    }
    const bytes = entry.nodeId
      ? await readWorkspaceTreeFile(bundle.workspace.id, entry.nodeId)
      : null;
    if (!bytes) {
      tree.push({
        path: entry.path,
        kind: "file",
        mime: entry.mime ?? null,
        size: entry.size ?? 0,
        missing: true,
      });
      continue;
    }
    const sha256 = collector.add(bytes, entry.path);
    if (!sha256) {
      skipped.push(`${bundle.workspace.name}: ${entry.path} (too large)`);
      tree.push({
        path: entry.path,
        kind: "file",
        mime: entry.mime ?? null,
        size: entry.size ?? bytes.byteLength,
        missing: true,
      });
      continue;
    }
    tree.push({
      path: entry.path,
      kind: "file",
      mime: entry.mime ?? null,
      size: bytes.byteLength,
      sha256,
    });
  }

  const payload = {
    id: bundle.workspace.id,
    workspace: {
      id: bundle.workspace.id,
      name: bundle.workspace.name,
      icon: bundle.workspace.icon ?? null,
      color: bundle.workspace.color ?? null,
      pinned: bundle.workspace.pinned === true,
      createdAt: bundle.workspace.createdAt,
      lastModified: bundle.workspace.lastModified,
    },
    // `status`/`error` are what this device's provider reported just now. They
    // differ per device, so syncing them would have two devices pushing the
    // same workspace back and forth over a transient "online"/"offline".
    sources: bundle.sources.map((source) => ({
      id: source.id,
      workspaceId: source.workspaceId,
      kind: source.kind,
      label: source.label,
      deviceId: source.deviceId,
      config: source.config,
      capabilities: source.capabilities,
      readOnly: source.readOnly,
      createdAt: source.createdAt,
      lastModified: source.lastModified,
    })),
    mounts: bundle.mounts.map((mount) => ({
      id: mount.id,
      workspaceId: mount.workspaceId,
      sourceId: mount.sourceId,
      sourcePath: mount.sourcePath,
      path: mount.path,
      readOnly: mount.readOnly === true,
      createdAt: mount.createdAt,
      lastModified: mount.lastModified,
    })),
    chats: bundle.chats,
    agents: bundle.agents,
    sessions: bundle.sessions,
    tree,
  };
  return { payload, assets: collector.take(), skipped };
};

const bundleOf = async (
  payload: any,
  ctx: ApplyContext,
): Promise<WorkspaceBundleForSync> => {
  const tree: WorkspaceBundleForSync["tree"] = [];
  for (const entry of payload?.tree ?? []) {
    if (!entry?.path) continue;
    if (entry.kind === "dir") {
      tree.push({ path: entry.path, kind: "dir" });
      continue;
    }
    const data =
      entry.sha256 && !entry.missing
        ? (await ctx.readAsset(entry.sha256)) ?? undefined
        : undefined;
    tree.push({
      path: entry.path,
      kind: "file",
      mime: entry.mime ?? undefined,
      size: entry.size,
      data,
    });
  }
  return {
    workspace: payload.workspace,
    sources: payload.sources ?? [],
    mounts: payload.mounts ?? [],
    chats: payload.chats ?? [],
    agents: payload.agents ?? [],
    sessions: payload.sessions ?? [],
    tree,
  };
};

export function createWorkspacesNamespace(): SyncNamespace {
  let skipped: string[] = [];

  return {
    name: "workspaces",
    async list(): Promise<LocalRecord[]> {
      skipped = [];
      const bundles = await listWorkspaceBundlesForSync();
      const records: LocalRecord[] = [];
      for (const bundle of bundles) {
        const serialized = await serialize(bundle);
        skipped.push(...serialized.skipped);
        records.push({
          namespace: "workspaces",
          id: serialized.payload.id,
          hash: hashPayload(serialized.payload),
          payload: serialized.payload,
          assets: serialized.assets,
          title: bundle.workspace.name,
        });
      }
      return records;
    },
    async apply(record: RemoteRecord, ctx: ApplyContext) {
      await applyWorkspaceBundle(await bundleOf(record.payload, ctx), null);
    },
    async remove(id: string) {
      await deleteWorkspaceForSync(id);
    },
    async duplicate(record: RemoteRecord, ctx: ApplyContext) {
      const payload = record.payload ?? {};
      const workspaceId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${record.id}-conflict-${Date.now()}`;
      await applyWorkspaceBundle(await bundleOf(payload, ctx), {
        workspaceId,
        name: `${payload.workspace?.name ?? "Workspace"}${CONFLICT_SUFFIX}`,
      });
    },
    titleOf(payload: any) {
      return String(payload?.workspace?.name ?? "Workspace");
    },
    takeSkipped() {
      const out = skipped;
      skipped = [];
      return out;
    },
  };
}
