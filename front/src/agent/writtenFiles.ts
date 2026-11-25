// Files the agent writes while answering, and images a tool returns, become attachments of its
// reply: they are saved as files of the conversation and reported as UI content items, so a
// "create a chart and show me" turn renders the image below the message and a png the agent reads
// shows up like a generated one. Uploads under /artefacts are input, not results.
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

/** Base64 payload (or a data URL) to bytes. */
function decodeImage(data: string): Uint8Array {
  const comma = data.indexOf(",");
  const base64 = comma === -1 ? data : data.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const isUserUpload = (path: string) => path === ARTEFACTS || path.startsWith(`${ARTEFACTS}/`);

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

/** An image block of a tool result, e.g. from the `read` tool or an MCP server. */
export interface ToolImage {
  /** Workspace path of the image; a path that is already shown is not attached again. */
  path?: string;
  /** Base64 payload, with or without a `data:` prefix. */
  data: string;
  mimeType?: string;
  /** File name to show; defaults to the path's last segment. */
  name?: string;
}

const extensions: Record<string, string> = { jpeg: "jpg" };

/**
 * The image blocks of a tool result as attachments. The tool call's path names them, so a read
 * png keeps the name it has in the workspace; otherwise the tool name numbers them.
 */
export function resultImages(
  result: { content?: any[] } | undefined,
  { path, toolName }: { path?: string; toolName?: string } = {},
): ToolImage[] {
  const blocks = Array.isArray(result?.content) ? result.content : [];
  return blocks.flatMap((block, index) => {
    if (block?.type !== "image" || typeof block.data !== "string") return [];
    const type = block.mimeType || "image/png";
    const extension = extensions[type.split("/")[1]] ?? type.split("/")[1] ?? "png";
    return [
      {
        path,
        name: path ? undefined : `${toolName || "image"}-${index + 1}.${extension}`,
        data: block.data,
        mimeType: block.mimeType,
      },
    ];
  });
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
    /**
     * Save an image a tool returned, so it appears with the reply's files and opens in the same
     * preview as a generated image. The user's uploads (/artefacts) are already visible in their
     * message, and a file that is already attached is not attached a second time.
     */
    async attachImage(image: ToolImage): Promise<void> {
      const path = image.path;
      if (path && (saved.has(path) || isUserUpload(path))) return;
      try {
        const name = image.name || path?.split("/").pop() || "image.png";
        const file = new File([decodeImage(image.data) as Uint8Array<ArrayBuffer>], name, {
          type: image.mimeType || guessType(name),
        });
        saved.set(path ?? `image:${saved.size}:${name}`, saveFile(conversationId, file));
      } catch (error) {
        console.warn("Could not attach a tool image:", error);
      }
    },
    /** The files written so far, as content items of the assistant message. */
    items(): FileContentItem[] {
      return [...saved.values()].map((fileId) => ({ type: "file", fileId }));
    },
  };
}
