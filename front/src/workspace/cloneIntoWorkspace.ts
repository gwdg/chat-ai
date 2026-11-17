import { addWorkspaceMount, getWorkspaceSource } from "../db/workspaceDb";
import { defaultCapabilities } from "./capabilities";
import { folderName } from "./folders";
import { normalizePath } from "./paths";
import { createProvider } from "./providers";
import type { FileProvider } from "./providers/types";
import {
  cleanupAgentClone,
  cloneId,
  cloneRepositoryWithAgent,
  copyAgentProjectToProvider,
  measureAgentProject,
  moveAgentCloneToTarget,
  readManifestFromAgent,
} from "./importProject";
import { createWorkspaceRootProvider } from "./workspaceRoot";
import { addLocalSource } from "./localWorkspace";

export type CloneIntoWorkspaceTarget =
  | "browser"
  | { sourceId: string }
  | { kind: "local"; handle: FileSystemDirectoryHandle }
  | { kind: "agent" };

export type CloneIntoWorkspaceStep =
  | "clone"
  | "manifest"
  | "measure"
  | "copy"
  | "mount";

export type CloneIntoWorkspaceProgress = {
  step: CloneIntoWorkspaceStep;
  files?: number;
  bytes?: number;
};

export type CloneIntoWorkspacePlan = {
  folder: string;
  path: string;
  target: CloneIntoWorkspaceTarget;
  manifest: unknown;
  measure: { files: number; bytes: number };
};

export type CloneIntoWorkspaceResult = {
  path: string;
  sourceId?: string;
  mountId?: string;
};

export type CloneIntoWorkspaceErrorCode =
  | "invalid-target"
  | "target-exists"
  | "target"
  | "source-missing"
  | "read-only"
  | "clone"
  | "manifest"
  | "measure"
  | "copy"
  | "mount"
  | "cancelled";

/** A clone failure with a stable stage code; `message` is safe to show to the user. */
export class CloneIntoWorkspaceError extends Error {
  readonly code: CloneIntoWorkspaceErrorCode;
  readonly cause?: unknown;

  constructor(
    code: CloneIntoWorkspaceErrorCode,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.name = "CloneIntoWorkspaceError";
    this.code = code;
    this.cause = options.cause;
  }
}

type CloneIntoWorkspaceInput = {
  workspaceId: string;
  agent: any;
  url: string;
  branch?: string;
  folder: string;
  target?: CloneIntoWorkspaceTarget;
  onProgress?: (event: CloneIntoWorkspaceProgress) => void;
  /**
   * Lets a caller review manifest and size after the clone is prepared. Returning false aborts
   * before anything is copied; the temporary clone is still cleaned up.
   */
  beforeCopy?: (
    plan: CloneIntoWorkspacePlan,
  ) => boolean | Promise<boolean>;
};

const messageOf = (event: unknown, fallback: string) =>
  event instanceof Error && event.message ? event.message : fallback;

const isNotFound = (event: unknown) =>
  (event as { code?: string } | null)?.code === "NOT_FOUND";

export async function cloneIntoWorkspace({
  workspaceId,
  agent,
  url,
  branch,
  folder,
  target = "browser",
  onProgress,
  beforeCopy,
}: CloneIntoWorkspaceInput): Promise<CloneIntoWorkspaceResult> {
  let relativeFolder: string;
  try {
    relativeFolder = folderName(folder, {
      maxLength: 120,
      rejectEmpty: true,
    });
  } catch (event) {
    throw new CloneIntoWorkspaceError(
      "invalid-target",
      "Choose a target folder for the clone.",
      { cause: event },
    );
  }
  const path = normalizePath(`/${relativeFolder}`);
  if (path === "/") {
    throw new CloneIntoWorkspaceError(
      "invalid-target",
      "Choose a target folder for the clone.",
    );
  }
  if (path === "/uploads" || path.startsWith("/uploads/")) {
    throw new CloneIntoWorkspaceError(
      "invalid-target",
      "The /uploads folder is reserved for chat uploads.",
    );
  }

  let provider: FileProvider | null = null;
  let sourceId: string | undefined;
  let tempBase: string | null = null;
  let createdSourceId: string | undefined;
  let agentTargetPath: string | null = null;
  let stage: CloneIntoWorkspaceErrorCode = "target";
  try {
    if (target === "browser") {
      provider = createWorkspaceRootProvider(workspaceId);
    } else if ("sourceId" in target) {
      const source = await getWorkspaceSource(target.sourceId);
      if (!source || source.workspaceId !== workspaceId) {
        throw new CloneIntoWorkspaceError(
          "source-missing",
          "The selected storage source is no longer available.",
        );
      }
      if (source.readOnly) {
        throw new CloneIntoWorkspaceError(
          "read-only",
          "The selected storage source is read-only.",
        );
      }
      provider = createProvider(source);
      if (provider.capabilities?.write !== true) {
        throw new CloneIntoWorkspaceError(
          "read-only",
          "The selected storage source cannot accept files.",
        );
      }
      sourceId = source.id;
    } else if (target.kind === "local") {
      sourceId = await addLocalSource({
        workspaceId,
        handle: target.handle,
      });
      createdSourceId = sourceId;
      const source = await getWorkspaceSource(sourceId);
      if (!source) {
        throw new CloneIntoWorkspaceError(
          "source-missing",
          "The local folder source could not be created.",
        );
      }
      provider = createProvider(source);
      if (provider.capabilities?.write !== true) {
        throw new CloneIntoWorkspaceError(
          "read-only",
          "The selected local folder cannot accept files.",
        );
      }
    } else if (target.kind !== "agent") {
      throw new CloneIntoWorkspaceError(
        "invalid-target",
        "Choose a storage target for the clone.",
      );
    }

    if (provider) {
      await provider.connect();
      const existing = await provider.stat(path).catch((event) => {
        if (isNotFound(event)) return null;
        throw event;
      });
      if (existing) {
        throw new CloneIntoWorkspaceError(
          "target-exists",
          "The target subfolder already exists.",
        );
      }
    }

    stage = "clone";
    const id = cloneId();
    tempBase = `.chat-ai-clones/${id}`;
    onProgress?.({ step: "clone" });
    const clone = await cloneRepositoryWithAgent({
      agent,
      url,
      branch,
      id,
      onProgress: () => {},
    });
    tempBase = clone.tempBase;

    stage = "manifest";
    onProgress?.({ step: "manifest" });
    const manifest = await readManifestFromAgent(agent, clone.repoDir);

    stage = "measure";
    onProgress?.({ step: "measure" });
    const measure = await measureAgentProject(agent, clone.repoDir);

    if (beforeCopy) {
      const proceed = await beforeCopy({
        folder: relativeFolder,
        path,
        target,
        manifest,
        measure,
      });
      if (!proceed) {
        throw new CloneIntoWorkspaceError("cancelled", "Clone cancelled.");
      }
    }

    let mountId: string | undefined;
    if (target !== "browser" && "kind" in target && target.kind === "agent") {
      stage = "copy";
      onProgress?.({ step: "copy" });
      await moveAgentCloneToTarget({
        agent,
        repoDir: clone.repoDir,
        targetPath: relativeFolder,
      });
      agentTargetPath = path;

      stage = "mount";
      onProgress?.({ step: "mount" });
      const { addSource } = await import("../db/workspaceDb");
      sourceId = await addSource({
        workspaceId,
        kind: "agent",
        label: agent.name || "Agent",
        config: { agentId: agent.id },
        capabilities: defaultCapabilities("agent"),
        readOnly: true,
        status: "offline",
      });
      if (!sourceId) {
        throw new CloneIntoWorkspaceError(
          "mount",
          "The agent storage source could not be created.",
        );
      }
      createdSourceId = sourceId;
      mountId = await addWorkspaceMount({
        workspaceId,
        sourceId,
        sourcePath: path,
        path,
        readOnly: true,
      });
      // Once the source and mount exist, the moved folder belongs to the workspace.
      agentTargetPath = null;
    } else {
      if (!provider) {
        throw new CloneIntoWorkspaceError(
          "copy",
          "The selected storage is no longer available.",
        );
      }
      stage = "copy";
      onProgress?.({ step: "copy" });
      await copyAgentProjectToProvider({
        agent,
        repoDir: clone.repoDir,
        provider,
        targetRoot: path,
        onProgress: ({ files, bytes }) =>
          onProgress?.({ step: "copy", files, bytes }),
      });
    }

    if (sourceId && !mountId) {
      stage = "mount";
      onProgress?.({ step: "mount" });
      mountId = await addWorkspaceMount({
        workspaceId,
        sourceId,
        sourcePath: path,
        path,
      });
    }

    return {
      path,
      ...(sourceId ? { sourceId } : {}),
      ...(mountId ? { mountId } : {}),
    };
  } catch (event) {
    if (agentTargetPath) {
      await cleanupAgentClone(agent, agentTargetPath).catch(() => {});
    }
    if (createdSourceId) {
      const { removeSource } = await import("../db/workspaceDb");
      await removeSource(createdSourceId).catch(() => {});
    }
    if (event instanceof CloneIntoWorkspaceError) throw event;
    throw new CloneIntoWorkspaceError(
      stage,
      messageOf(event, `Clone failed during ${stage}.`),
      { cause: event },
    );
  } finally {
    if (tempBase) await cleanupAgentClone(agent, tempBase).catch(() => {});
    provider?.close?.();
  }
}
