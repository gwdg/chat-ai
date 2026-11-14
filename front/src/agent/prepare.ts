// Attachments are copied into /artefacts in the attached workspace (or the conversation's
// workspace when none is attached) and converted (documents → .md, audio → .txt) as soon as they
// are attached, not when the message is sent. Each file is prepared once; sending awaits the
// same job, so sending before it finishes still works.
// Kept free of the agent runtime, which loads only when a message is sent.
import { useSyncExternalStore } from "react";
import { convertDocument, transcribeAudio } from "../apis/agentEndpoints";
import { loadFile } from "../db";
import { getFileType } from "../utils/attachments";
import { getWorkspace } from "./workspace";
import { getChatWorkspaceId } from "../db/workspaceDb";
import { SHARED_BROWSER_STORAGE_ID } from "../workspace/browserStorage";
import { getSourceBlob, getSourceNode, writeSourceFile } from "../db/workspaceVfs";

export const ARTEFACTS = "/artefacts";
export const uploadPath = (fileId: string, name: string) => `${ARTEFACTS}/${fileId.slice(0, 8)}/${name}`;

export type PrepareStatus = "converting" | "transcribing";

/** Resolves to the transcript for audio, otherwise null. */
const jobs = new Map<string, Promise<string | null>>();

const statuses = new Map<string, PrepareStatus>();
const listeners = new Set<() => void>();
function setStatus(fileId: string, status: PrepareStatus | null) {
  if (status) statuses.set(fileId, status);
  else statuses.delete(fileId);
  for (const listener of listeners) listener();
}

/** What is being done with an attachment right now, for the attachment card. */
export function usePrepareStatus(fileId: string): PrepareStatus | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => statuses.get(fileId),
  );
}

/**
 * Copies an attachment into the workspace and converts it. Pass the File when it was just
 * saved: saveFile writes in the background, so loading it back may not work yet.
 */
export async function prepareAttachment(
  conversationId: string,
  fileId: string,
  file?: File,
): Promise<string | null> {
  const workspaceId = await getChatWorkspaceId(conversationId);
  const key = `${fileId}:${workspaceId ?? ""}`;
  let job = jobs.get(key);
  if (!job) {
    job = prepare(conversationId, workspaceId, fileId, key, file);
    jobs.set(key, job);
  }
  return job;
}

async function prepare(
  conversationId: string,
  workspaceId: string | null,
  fileId: string,
  key: string,
  file?: File,
): Promise<string | null> {
  const rootId = workspaceId ? SHARED_BROWSER_STORAGE_ID : null;
  const fs = rootId ? null : await getWorkspace(conversationId);
  file ??= (await loadFile(fileId)) ?? undefined;
  if (!file) {
    jobs.delete(key);
    return null;
  }

  const exists = async (path: string) =>
    rootId ? !!(await getSourceNode(rootId, path)) : !!(await fs!.stat(path));
  const write = async (path: string, data: Uint8Array) => {
    if (rootId) await writeSourceFile(rootId, path, data);
    else await fs!.writeFile(path, data);
  };
  const read = async (path: string): Promise<Uint8Array | null> => {
    if (!rootId) return fs!.readFile(path);
    const node = await getSourceNode(rootId, path);
    if (!node) return null;
    return (await getSourceBlob(rootId, node.id)) ?? null;
  };

  const path = uploadPath(fileId, file.name);
  const kind = getFileType(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(await exists(path))) await write(path, bytes);

  const isDocument = ["pdf", "docx", "excel"].includes(kind);
  const isAudio = kind === "audio";
  if (!isDocument && !isAudio) return null;
  const variant = `${path}${isAudio ? ".txt" : ".md"}`;
  if (await exists(variant)) {
    const data = await read(variant);
    return isAudio && data ? new TextDecoder().decode(data) : null;
  }

  setStatus(fileId, isAudio ? "transcribing" : "converting");
  try {
    const text = isAudio ? await transcribeAudio(bytes, file.name) : await convertDocument(bytes, file.name);
    await write(variant, new TextEncoder().encode(text));
    return isAudio ? text : null;
  } catch (error) {
    console.warn(`Could not convert ${path}:`, error);
    // Let the next attempt (at the latest, sending) try again
    jobs.delete(key);
    return null;
  } finally {
    setStatus(fileId, null);
  }
}
