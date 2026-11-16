// Files the agent writes while answering become attachments of its reply: they are saved as
// files of the conversation and reported as UI content items, so a "create a chart and show me"
// turn can render the image below the message. Uploads under /artefacts are input, not results.
import { saveFile } from "../db";
import { ARTEFACTS } from "./artefacts";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  txt: "text/plain",
};

/** Content type from the file name; anything unknown is sent as text. */
export const guessType = (name: string) =>
  TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "text/plain";

/** The part of the workspace written files are read back from. */
export interface ReadableWorkspace {
  readFile(path: string): Promise<Uint8Array>;
}

export interface WrittenChange {
  path: string;
  kind: "write" | "remove";
}

export interface FileContentItem {
  type: "file";
  fileId: string;
}

/**
 * Collects the workspace paths the agent writes and saves them as files of the conversation.
 * Call `save()` after each tool execution so a file the agent just created is already usable
 * while the turn continues; a path written twice keeps one item.
 */
export function createWrittenFiles(conversationId: string, workspace: ReadableWorkspace) {
  const pending = new Set<string>();
  const saved = new Map<string, string>();
  return {
    /** Record a workspace change; writes below /artefacts are the user's uploads. */
    observe(change: WrittenChange) {
      if (change.kind !== "write") return;
      if (change.path === ARTEFACTS || change.path.startsWith(`${ARTEFACTS}/`)) return;
      pending.add(change.path);
    },
    async save(): Promise<void> {
      for (const path of [...pending]) {
        pending.delete(path);
        try {
          const bytes = await workspace.readFile(path);
          const name = path.split("/").pop() || "file";
          const file = new File([bytes as Uint8Array<ArrayBuffer>], name, {
            type: guessType(name),
          });
          saved.set(path, saveFile(conversationId, file));
        } catch (error) {
          console.warn(`Could not attach ${path}:`, error);
        }
      }
    },
    /** The files written so far, as content items of the assistant message. */
    items(): FileContentItem[] {
      return [...saved.values()].map((fileId) => ({ type: "file", fileId }));
    },
  };
}
