import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../../db/dbTypes";
import {
  createArcana,
  deleteArcanaFile,
  listArcanaFiles,
  listArcanas,
  readArcanaFile,
  replaceArcanaFile,
  uploadArcanaFile,
} from "../../agent/arcanaV2";
import { defaultCapabilities } from "../capabilities";
import { normalizePath } from "../paths";
import type { DirectoryPage, FileProvider } from "./types";
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

const normalizeArcanas = (data: any): string[] => {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.arcanas)
      ? data.arcanas
      : [];
  return rows
    .map((row: any) =>
      String(
        typeof row === "string" ? row : row?.name ?? row?.arcana ?? row?.id ?? "",
      ).trim(),
    )
    .filter(Boolean);
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

const toStream = (data: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

const page = (entries: WorkspaceFileEntry[], cursor?: string): DirectoryPage => {
  const start = cursor ? Number(cursor) : 0;
  const slice = entries.slice(start, start + 200);
  return {
    entries: slice,
    next: start + slice.length < entries.length ? String(start + slice.length) : undefined,
  };
};

export class ArcanaFilesystemProvider implements FileProvider {
  readonly kind = "arcana-filesystem" as const;
  readonly capabilities: WorkspaceCapabilities =
    defaultCapabilities("arcana-filesystem");
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";

  constructor(readonly sourceId: string) {}

  async connect() {
    try {
      await this.listArcanas();
      this.status = "connected";
    } catch (error) {
      this.status = "error";
      const message = error instanceof Error ? error.message : String(error);
      if (/401|403|auth/i.test(message)) {
        throw new WorkspaceError("AUTH_EXPIRED", message);
      }
      throw new WorkspaceError("PROVIDER_ERROR", message);
    }
  }

  private async listArcanas(): Promise<string[]> {
    return normalizeArcanas(await listArcanas());
  }

  private parts(path: string): string[] {
    return normalizePath(path).split("/").filter(Boolean);
  }

  private async requireArcana(name: string): Promise<void> {
    const arcanas = await this.listArcanas();
    if (!arcanas.includes(name)) {
      throw new WorkspaceError("NOT_FOUND", name);
    }
  }

  private async files(arcana: string): Promise<ArcanaFile[]> {
    return normalizeFiles(await listArcanaFiles(arcana)).filter((file) =>
      fileName(file),
    );
  }

  private fileEntry(arcana: string, file: ArcanaFile): WorkspaceFileEntry {
    const name = fileName(file);
    return {
      sourceId: this.sourceId,
      path: `/${arcana}/${name}`,
      name,
      kind: "file",
      size: fileSize(file),
      mtime: file.mtime ?? file.updated_at ?? file.created_at,
      mime: file.mime ?? file.content_type,
    };
  }

  async list(path: string, cursor?: string): Promise<DirectoryPage> {
    const parts = this.parts(path);
    if (parts.length === 0) {
      const arcanas = await this.listArcanas();
      return page(
        arcanas.map((name) => ({
          sourceId: this.sourceId,
          path: `/${name}`,
          name,
          kind: "dir" as const,
        })),
        cursor,
      );
    }
    if (parts.length !== 1) {
      throw new WorkspaceError("UNSUPPORTED", "Arcana collections are flat");
    }
    const arcana = parts[0];
    await this.requireArcana(arcana);
    const files = await this.files(arcana);
    return page(
      files
        .map((file) => this.fileEntry(arcana, file))
        .sort((a, b) => a.name.localeCompare(b.name)),
      cursor,
    );
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const parts = this.parts(path);
    if (parts.length === 0) {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    if (parts.length === 1) {
      await this.requireArcana(parts[0]);
      return {
        sourceId: this.sourceId,
        path: `/${parts[0]}`,
        name: parts[0],
        kind: "dir",
      };
    }
    if (parts.length !== 2) {
      throw new WorkspaceError("UNSUPPORTED", "Arcana collections are flat");
    }
    const [arcana, name] = parts;
    const file = (await this.files(arcana)).find(
      (entry) => fileName(entry) === name,
    );
    if (!file) throw new WorkspaceError("NOT_FOUND", path);
    return this.fileEntry(arcana, file);
  }

  async read(path: string, range?: { start: number; end: number }) {
    const parts = this.parts(path);
    if (parts.length !== 2) {
      throw new WorkspaceError("UNSUPPORTED", "Not an Arcana file");
    }
    const [arcana, name] = parts;
    const result = await readArcanaFile(arcana, name, "base64");
    const data = fromBase64(String(result?.content ?? ""));
    const sliced = range ? data.slice(range.start, range.end) : data;
    return toStream(sliced);
  }

  async write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<WorkspaceFileEntry> {
    const parts = this.parts(path);
    if (parts.length !== 2) {
      throw new WorkspaceError("UNSUPPORTED", "Arcana collections are flat");
    }
    const [arcana, name] = parts;
    await this.requireArcana(arcana);
    const exists = (await this.files(arcana)).some(
      (entry) => fileName(entry) === name,
    );
    if (exists && !opts.overwrite) {
      throw new WorkspaceError("CONFLICT", path);
    }
    const bytes = await readAll(data);
    const content = toBase64(bytes);
    if (exists) {
      await replaceArcanaFile(arcana, name, content, "base64");
    } else {
      await uploadArcanaFile(arcana, name, content, "base64");
    }
    return {
      sourceId: this.sourceId,
      path: `/${arcana}/${name}`,
      name,
      kind: "file",
      size: bytes.byteLength,
    };
  }

  async mkdir(path: string) {
    const parts = this.parts(path);
    if (parts.length !== 1) {
      throw new WorkspaceError("UNSUPPORTED", "Arcana collections are flat");
    }
    await createArcana(parts[0]);
    this.status = "connected";
  }

  async remove(path: string) {
    const parts = this.parts(path);
    if (parts.length !== 2) {
      throw new WorkspaceError(
        "UNSUPPORTED",
        "Deleting Arcana collections is not supported",
      );
    }
    const [arcana, name] = parts;
    await deleteArcanaFile(arcana, name);
  }

  async copy(from: string, to: string) {
    const content = await readAll(await this.read(from));
    await this.write(to, toStream(content), {
      size: content.length,
      overwrite: false,
    });
  }

  async move(from: string, to: string) {
    await this.copy(from, to);
    await this.remove(from);
  }
}
