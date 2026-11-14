import type {
  SourceKind,
  WorkspaceCapabilities,
  WorkspaceFileEntry,
} from "../../db/dbTypes";

export type ProviderEntry = WorkspaceFileEntry;

export type DirectoryPage = {
  entries: ProviderEntry[];
  next?: string;
};

export type QuotaInfo = {
  usage: number;
  quota: number;
  free?: number;
  scope: "origin" | "account";
};

export interface FileProvider {
  readonly sourceId: string;
  readonly kind: SourceKind;
  readonly capabilities: WorkspaceCapabilities;
  readonly status: "connected" | "needs-permission" | "offline" | "error";
  connect(): Promise<void>;
  list(path: string, cursor?: string): Promise<DirectoryPage>;
  stat(path: string): Promise<ProviderEntry>;
  read(
    path: string,
    range?: { start: number; end: number },
  ): Promise<ReadableStream<Uint8Array>>;
  write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<ProviderEntry>;
  mkdir(path: string): Promise<void>;
  remove(path: string, opts: { recursive: boolean }): Promise<void>;
  move?(from: string, to: string): Promise<void>;
  copy?(from: string, to: string): Promise<void>;
  quota?(): Promise<QuotaInfo | null>;
  close?(): void;
}

export class WorkspaceError extends Error {
  constructor(
    readonly code:
      | "PERMISSION_DENIED"
      | "NOT_FOUND"
      | "CONFLICT"
      | "QUOTA_EXCEEDED"
      | "UNSUPPORTED"
      | "OFFLINE"
      | "AUTH_EXPIRED"
      | "PROVIDER_ERROR"
      | "CANCELLED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "WorkspaceError";
  }
}
