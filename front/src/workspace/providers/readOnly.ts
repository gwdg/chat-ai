import type { WorkspaceCapabilities } from "../../db/dbTypes";
import type { FileProvider } from "./types";
import { WorkspaceError } from "./types";

const readOnlyCapabilities = (
  capabilities: WorkspaceCapabilities,
): WorkspaceCapabilities => ({
  ...capabilities,
  write: false,
  delete: false,
  mkdir: false,
  rename: false,
  move: false,
  copy: false,
});

export class ReadOnlyProvider implements FileProvider {
  readonly capabilities: WorkspaceCapabilities;

  constructor(private readonly inner: FileProvider) {
    this.capabilities = readOnlyCapabilities(inner.capabilities);
  }

  get sourceId() {
    return this.inner.sourceId;
  }

  get storageId() {
    return this.inner.storageId;
  }

  get kind() {
    return this.inner.kind;
  }

  get status() {
    return this.inner.status;
  }

  connect() {
    return this.inner.connect();
  }

  list(path: string, cursor?: string) {
    return this.inner.list(path, cursor);
  }

  stat(path: string) {
    return this.inner.stat(path);
  }

  read(path: string, range?: { start: number; end: number }) {
    return this.inner.read(path, range);
  }

  async write() {
    throw new WorkspaceError("PERMISSION_DENIED", "Source is read-only");
  }

  async mkdir() {
    throw new WorkspaceError("PERMISSION_DENIED", "Source is read-only");
  }

  async remove() {
    throw new WorkspaceError("PERMISSION_DENIED", "Source is read-only");
  }

  async move() {
    throw new WorkspaceError("PERMISSION_DENIED", "Source is read-only");
  }

  async copy() {
    throw new WorkspaceError("PERMISSION_DENIED", "Source is read-only");
  }

  quota() {
    return this.inner.quota ? this.inner.quota() : Promise.resolve(null);
  }

  close() {
    this.inner.close?.();
  }
}
