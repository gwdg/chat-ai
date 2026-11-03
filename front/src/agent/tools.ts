import type { AgentTool } from "@earendil-works/pi-agent-core";

import explainImage from "../apis/explainImage";
import type {
  FileSystemProvider,
} from "../filesystem";
import { baseName } from "../filesystem/paths";
import type { VfsNodeRow } from "../db/dbTypes";

export const SKILL_EXPLAIN_IMAGE = "explain-image";

export type WorkspaceToolContext = {
  fs: FileSystemProvider;
  skills: string[];
  onMutation?: () => void;
};

const MAX_READ_CHARS = 200_000;

function textResult(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: "text" as const, text }], details };
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number") return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function entryLine(node: VfsNodeRow): string {
  const relative = node.path;
  if (node.type === "folder") return `[folder] ${relative}/`;
  const size = formatBytes(node.size);
  return `[file]   ${relative}${size ? ` (${size})` : ""}`;
}

function extension(path: string): string {
  const name = baseName(path).toLowerCase();
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1);
}

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "yaml", "yml", "toml", "ini", "csv", "tsv",
  "js", "jsx", "ts", "tsx", "css", "scss", "html", "htm", "xml", "svg", "py",
  "rb", "go", "rs", "java", "c", "h", "cpp", "hpp", "sh", "bash", "sql", "log",
]);

function looksTextual(node: VfsNodeRow): boolean {
  const mime = (node.mimeType || "").toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (mime.includes("json") || mime.includes("xml") || mime.includes("yaml")) return true;
  return TEXT_EXTENSIONS.has(extension(node.path));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

export function createWorkspaceTools({
  fs,
  skills,
  onMutation,
}: WorkspaceToolContext): AgentTool<any>[] {
  const tools: AgentTool<any>[] = [
    {
      name: "list_files",
      label: "List files",
      description:
        "List the files and folders in the workspace. Paths are relative to the workspace root; omit path for the root.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative folder path. Defaults to the workspace root." },
          depth: { type: "number", description: "How many folder levels to show (1-5). Defaults to 1." },
        },
      },
      execute: async (_id, params: any = {}) => {
        const depth = Math.min(Math.max(Number(params.depth) || 1, 1), 5);
        const lines: string[] = [];

        async function walk(relativePath: string, level: number, prefix: string) {
          const children = await fs.list(relativePath);
          if (!children.length && level === 1) lines.push("(empty folder)");
          for (const child of children) {
            lines.push(`${prefix}${entryLine({ ...child, path: fs.relativePath(child.path) })}`);
            if (child.type === "folder" && level < depth) {
              await walk(fs.relativePath(child.path), level + 1, `${prefix}  `);
            }
          }
        }

        await walk(params.path || ".", 1, "");
        return textResult(lines.length ? lines.join("\n") : "(empty folder)", {
          path: params.path || ".",
          depth,
        });
      },
    },
    {
      name: "read_file",
      label: "Read file",
      description:
        "Read a UTF-8 text file from the workspace. Use explain_image for image files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path of the file to read." },
        },
        required: ["path"],
      },
      execute: async (_id, params: any = {}) => {
        const node = await fs.stat(params.path);
        if (!node) throw new Error(`File not found: ${params.path}`);
        if (node.type === "folder") throw new Error(`"${params.path}" is a folder`);
        const blob = await fs.readFile(params.path);
        if (!blob) throw new Error(`File not found: ${params.path}`);
        if (!looksTextual(node)) {
          throw new Error(
            `"${params.path}" is a binary file (${node.mimeType || "unknown type"}). Use explain_image for images.`,
          );
        }
        const text = await blob.text();
        const truncated = text.length > MAX_READ_CHARS;
        return textResult(
          truncated
            ? `${text.slice(0, MAX_READ_CHARS)}\n\n[truncated: file is ${text.length} characters]`
            : text,
          { path: params.path, size: node.size, truncated },
        );
      },
    },
    {
      name: "write_file",
      label: "Write file",
      description:
        "Create or overwrite a text file in the workspace. Parent folders are created automatically.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path of the file to write." },
          content: { type: "string", description: "Complete new file content." },
          mime_type: { type: "string", description: "Optional MIME type, e.g. text/markdown." },
        },
        required: ["path", "content"],
      },
      executionMode: "sequential",
      execute: async (_id, params: any = {}) => {
        if (typeof params.content !== "string") throw new Error("content must be a string");
        const node = await fs.writeFile(
          params.path,
          params.content,
          params.mime_type || "text/plain",
        );
        onMutation?.();
        return textResult(`Wrote ${fs.relativePath(node.path)} (${formatBytes(node.size)}).`, {
          path: fs.relativePath(node.path),
          size: node.size,
        });
      },
    },
    {
      name: "create_folder",
      label: "Create folder",
      description: "Create a folder (including missing parent folders) in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative folder path to create." },
        },
        required: ["path"],
      },
      executionMode: "sequential",
      execute: async (_id, params: any = {}) => {
        const node = await fs.mkdir(params.path);
        onMutation?.();
        return textResult(`Created folder ${fs.relativePath(node.path)}.`, {
          path: fs.relativePath(node.path),
        });
      },
    },
    {
      name: "move_path",
      label: "Move or rename",
      description: "Move or rename a file or folder inside the workspace.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Current relative path." },
          to: { type: "string", description: "New relative path." },
        },
        required: ["from", "to"],
      },
      executionMode: "sequential",
      execute: async (_id, params: any = {}) => {
        await fs.move(params.from, params.to);
        onMutation?.();
        return textResult(`Moved ${params.from} to ${params.to}.`, params);
      },
    },
    {
      name: "delete_path",
      label: "Delete",
      description: "Delete a file or folder (folders are deleted recursively).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path to delete." },
        },
        required: ["path"],
      },
      executionMode: "sequential",
      execute: async (_id, params: any = {}) => {
        await fs.remove(params.path);
        onMutation?.();
        return textResult(`Deleted ${params.path}.`, params);
      },
    },
  ];

  if (skills.includes(SKILL_EXPLAIN_IMAGE)) {
    tools.push({
      name: "explain_image",
      label: "Explain image",
      description:
        "Look at an image stored in the workspace and return a detailed description. Use this instead of read_file for images.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path of the image." },
          question: {
            type: "string",
            description: "Optional specific question about the image.",
          },
        },
        required: ["path"],
      },
      execute: async (_id, params: any = {}) => {
        const node = await fs.stat(params.path);
        if (!node || node.type !== "file") throw new Error(`File not found: ${params.path}`);
        const blob = await fs.readFile(params.path);
        if (!blob) throw new Error(`File not found: ${params.path}`);
        const mime = blob.type || node.mimeType || "";
        if (!mime.startsWith("image/")) {
          throw new Error(`"${params.path}" is not an image (${mime || "unknown type"})`);
        }
        const dataUrl = await blobToDataUrl(blob);
        const description = await explainImage({
          dataUrl,
          question:
            params.question ||
            "Describe this image in detail. Mention any text in it verbatim.",
        });
        return textResult(description, { path: params.path, model: "explain-image" });
      },
    });
  }

  return tools;
}
