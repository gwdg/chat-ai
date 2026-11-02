// Attachments are copied into the conversation's workspace and converted (documents → .md,
// audio → .txt) as soon as they are attached, not when the message is sent. Each file is
// prepared once; sending awaits the same job, so sending before it finishes still works.
// Kept free of the agent runtime, which loads only when a message is sent.
import { useSyncExternalStore } from "react";
import { convertDocument, transcribeAudio } from "../apis/agentEndpoints";
import { loadFile } from "../db";
import { getFileType } from "../utils/attachments";
import { getWorkspace } from "./workspace";
import { canConvertDocumentLocally, convertDocumentLocally } from "../utils/browserDocumentConversion";
import store from "../Redux/store/store";
import { selectDocumentConversionMode } from "../Redux/reducers/userSettingsReducer";

export const UPLOADS = "/uploads";
export const uploadPath = (fileId: string, name: string) => `${UPLOADS}/${fileId.slice(0, 8)}/${name}`;

export type ConversionMethod = "browser" | "server";
export type PrepareStatus = "converting_browser" | "converting_server" | "convert_failed" | "transcribing";

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

/** The method last used per document, so the card can offer the other one. */
const methods = new Map<string, ConversionMethod>();
export const conversionMethodOf = (fileId: string) => methods.get(fileId);
const runs = new Map<string, number>();

/** Converts a document again with the given method, replacing any earlier result. */
export function reconvertAttachment(conversationId: string, fileId: string, method: ConversionMethod) {
  const job = prepare(conversationId, fileId, undefined, method, true);
  jobs.set(fileId, job);
  return job;
}

async function prepare(
  conversationId: string,
  fileId: string,
  file?: File,
  method?: ConversionMethod,
  force = false,
): Promise<string | null> {
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
  if (!force && (await fs.stat(variant))) return isAudio ? new TextDecoder().decode(await fs.readFile(variant)) : null;

  // Documents follow the conversion setting; the browser handles PDF and DOCX only
  const chosen = method ?? (selectDocumentConversionMode(store.getState()) as ConversionMethod);
  const useBrowser = !isAudio && chosen === "browser" && canConvertDocumentLocally(kind);
  if (!isAudio) methods.set(fileId, useBrowser ? "browser" : "server");
  const run = (runs.get(fileId) ?? 0) + 1;
  runs.set(fileId, run);

  setStatus(fileId, isAudio ? "transcribing" : useBrowser ? "converting_browser" : "converting_server");
  try {
    const text = isAudio
      ? await transcribeAudio(bytes, file.name)
      : useBrowser
        ? ((await convertDocumentLocally(file, kind))?.content ?? "")
        : await convertDocument(bytes, file.name);
    if (!isAudio && !text) throw new Error("no text extracted");
    // A newer attempt (the user switched method) supersedes this one
    if (runs.get(fileId) !== run) return null;
    await fs.writeFile(variant, text);
    setStatus(fileId, null);
    return isAudio ? text : null;
  } catch (error) {
    console.warn(`Could not convert ${path}:`, error);
    if (runs.get(fileId) !== run) return null;
    // Let the next attempt (at the latest, sending) try again
    jobs.delete(fileId);
    setStatus(fileId, isAudio ? null : "convert_failed");
    return null;
  }
}
