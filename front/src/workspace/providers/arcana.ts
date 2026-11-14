import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../../db/dbTypes";
import {
  deleteArcanaFile,
  getArcanaQuota,
  listArcanaFiles,
  readArcanaFile,
  replaceArcanaFile,
  uploadArcanaFile,
} from "../../agent/arcanaV2";
import { defaultCapabilities } from "../capabilities";
import { baseName, normalizePath } from "../paths";
import type { DirectoryPage, FileProvider, QuotaInfo } from "./types";
import { WorkspaceError } from "./types";

type ArcanaFile = {
  filename?: string;
  name?: string;
  file?: string;
  size?: number;
  size_bytes?: number;
  bytes?: number;
  mtime?: string;
  updated_at?: string;
  created_at?: string;
  mime?: string;
  content_type?: string;
};

const normalizeFiles = (data: any): ArcanaFile[] => {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.files)
      ? data.files
      : [];
  return rows.map((row: any) =>
    typeof row === "string" ? { filename: row } : row,
  );
};

const fileName = (file: ArcanaFile): string =>
  String(file.filename ?? file.name ?? file.file ?? "").trim();

const fileSize = (file: ArcanaFile): number | undefined => {
  const value = file.size ?? file.size_bytes ?? file.bytes;
  return typeof value === "number" ? value : Number(value) || undefined;
};

const toBase64 = (data: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
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
  const data = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) {
    data.set(part, offset);
    offset += part.length;
  }
  return data;
};

export class ArcanaProvider implements FileProvider {
  readonly kind = "arcana" as const;
  readonly capabilities: WorkspaceCapabilities = defaultCapabilities("arcana");
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";
  private files: ArcanaFile[] = [];

  constructor(
    readonly sourceId: string,
    readonly remoteWorkspaceId: string,
  ) {}

  async connect() {
    try {
      this.files = normalizeFiles(await listArcanaFiles(this.remoteWorkspaceId));
      this.status = "connected";
    } catch (error) {
      this.status = "error";
      const message = error instanceof Error ? error.message : String(error);
      if (/401|403|auth/i.test(message)) {
        throw new WorkspaceError("AUTH_EXPIRED", message);
      }
      if (/404|not found/i.test(message)) {
        throw new WorkspaceError("NOT_FOUND", message);
      }
      throw new WorkspaceError("PROVIDER_ERROR", message);
    }
  }

  private async refresh() {
    this.files = normalizeFiles(await listArcanaFiles(this.remoteWorkspaceId));
  }

  async list(path: string, cursor?: string): Promise<DirectoryPage> {
    const normalized = normalizePath(path);
    if (normalized !== "/") {
      throw new WorkspaceError("UNSUPPORTED", "Arcana sources are flat");
    }
    await this.refresh();
    const entries = this.files
      .filter((file) => fileName(file))
      .map((file) => this.entry(file))
      .sort((a, b) => a.name.localeCompare(b.name));
    const start = cursor ? Number(cursor) : 0;
    const page = entries.slice(start, start + 200);
    return {
      entries: page,
      next: start + page.length < entries.length ? String(start + page.length) : undefined,
    };
  }

  private entry(file: ArcanaFile): WorkspaceFileEntry {
    const name = fileName(file);
    return {
      sourceId: this.sourceId,
      path: `/${name}`,
      name,
      kind: "file",
      size: fileSize(file),
      mtime: file.mtime ?? file.updated_at ?? file.created_at,
      mime: file.mime ?? file.content_type,
    };
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    const file = this.files.find(
      (entry) => fileName(entry) === baseName(normalized),
    );
    if (!file) throw new WorkspaceError("NOT_FOUND", normalized);
    return this.entry(file);
  }

  async read(path: string, range?: { start: number; end: number }) {
    const result = await readArcanaFile(
      this.remoteWorkspaceId,
      baseName(path),
      "base64",
    );
    const data = fromBase64(String(result?.content ?? ""));
    const sliced = range ? data.slice(range.start, range.end) : data;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(sliced);
        controller.close();
      },
    });
  }

  async write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    const name = baseName(normalized);
    if (!name || normalized.split("/").filter(Boolean).length !== 1) {
      throw new WorkspaceError("UNSUPPORTED", "Arcana sources are flat");
    }
    const exists = this.files.some((file) => fileName(file) === name);
    if (exists && !opts.overwrite) throw new WorkspaceError("CONFLICT", normalized);
    const bytes = await readAll(data);
    const content = toBase64(bytes);
    if (exists) await replaceArcanaFile(this.remoteWorkspaceId, name, content, "base64");
    else await uploadArcanaFile(this.remoteWorkspaceId, name, content, "base64");
    await this.refresh();
    return this.stat(normalized);
  }

  async mkdir() {
    throw new WorkspaceError("UNSUPPORTED");
  }

  async remove(path: string) {
    await deleteArcanaFile(this.remoteWorkspaceId, baseName(path));
    await this.refresh();
  }

  async copy(from: string, to: string) {
    const content = await readAll(
      await this.read(
        from,
      ),
    );
    await this.write(to, toStream(content), {
      size: content.length,
      overwrite: false,
    });
  }

  async move(from: string, to: string) {
    await this.copy(from, to);
    await this.remove(from);
  }

  async quota(): Promise<QuotaInfo | null> {
    try {
      const data = await getArcanaQuota(this.remoteWorkspaceId);
      if (!data) return null;
      const usage = Number(data.usage ?? data.used ?? data.used_bytes ?? 0);
      const quota = Number(data.quota ?? data.limit ?? data.total ?? 0);
      if (!quota && !usage) return null;
      return {
        usage,
        quota,
        free:
          data.free !== undefined
            ? Number(data.free)
            : quota
              ? Math.max(0, quota - usage)
              : undefined,
        scope: "account",
      };
    } catch {
      return null;
    }
  }
}

function toStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}
