// Attachments are copied into the conversation's workspace and converted (documents → .md,
// audio → .txt) as soon as they are attached, not when the message is sent. Each file is
// prepared once; sending awaits the same job, so sending before it finishes still works.
// Kept free of the agent runtime, which loads only when a message is sent.
import { useSyncExternalStore } from "react";
import { convertDocument, transcribeAudio } from "../apis/agentEndpoints";
import { loadFile } from "../db";
import { getFileType } from "../utils/attachments";
import { getWorkspace } from "./workspace";

export const UPLOADS = "/uploads";
export const uploadPath = (fileId: string, name: string) => `${UPLOADS}/${fileId.slice(0, 8)}/${name}`;

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
export function prepareAttachment(conversationId: string, fileId: string, file?: File): Promise<string | null> {
  let job = jobs.get(fileId);
  if (!job) {
    job = prepare(conversationId, fileId, file);
    jobs.set(fileId, job);
  }
  return job;
}

async function prepare(conversationId: string, fileId: string, file?: File): Promise<string | null> {
  const fs = await getWorkspace(conversationId);
  file ??= (await loadFile(fileId)) ?? undefined;
  if (!file) {
    jobs.delete(fileId);
    return null;
  }
  const path = uploadPath(fileId, file.name);
  const kind = getFileType(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(await fs.stat(path))) await fs.writeFile(path, bytes);

  const isDocument = ["pdf", "docx", "excel"].includes(kind);
  const isAudio = kind === "audio";
  if (!isDocument && !isAudio) return null;
  const variant = `${path}${isAudio ? ".txt" : ".md"}`;
  if (await fs.stat(variant)) return isAudio ? new TextDecoder().decode(await fs.readFile(variant)) : null;

  setStatus(fileId, isAudio ? "transcribing" : "converting");
  try {
    const text = isAudio ? await transcribeAudio(bytes, file.name) : await convertDocument(bytes, file.name);
    await fs.writeFile(variant, text);
    return isAudio ? text : null;
  } catch (error) {
    console.warn(`Could not convert ${path}:`, error);
    // Let the next attempt (at the latest, sending) try again
    jobs.delete(fileId);
    return null;
  } finally {
    setStatus(fileId, null);
  }
}
