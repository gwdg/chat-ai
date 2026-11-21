import { saiaFsMcpUrl } from "../../apis/saiaFs";
import { readAll, streamOf } from "../../workspace/bytes";
import { SaiaFsProvider } from "../../workspace/providers/saiaFs";
import type { StoredEntry, SyncStore } from "./types";

/**
 * The user's SAIA filesystem as a sync store.
 *
 * The provider is created lazily and kept for the lifetime of the store: an MCP
 * handshake is not free, and a sync run performs dozens of calls. A single
 * failed call (an expired session, a restarted service) drops the provider so
 * the next call reconnects instead of failing the whole run.
 */
export class SaiaFsSyncStore implements SyncStore {
  private provider: SaiaFsProvider | null = null;
  private connecting: Promise<SaiaFsProvider> | null = null;

  constructor(
    private readonly endpoint: string = saiaFsMcpUrl(),
    private readonly sourceId = "sync",
  ) {}

  private async open(): Promise<SaiaFsProvider> {
    if (this.provider) return this.provider;
    if (!this.connecting) {
      const provider = new SaiaFsProvider(this.sourceId, this.endpoint);
      this.connecting = provider
        .connect()
        .then(() => {
          this.provider = provider;
          return provider;
        })
        .finally(() => {
          this.connecting = null;
        });
    }
    return this.connecting;
  }

  private reset() {
    try {
      this.provider?.close();
    } catch {
      // A transport that is already gone must not mask the original failure.
    }
    this.provider = null;
  }

  /** Run a provider call once, retrying after a reconnect. */
  private async call<T>(
    run: (provider: SaiaFsProvider) => Promise<T>,
  ): Promise<T> {
    const provider = await this.open();
    try {
      return await run(provider);
    } catch (error) {
      const code = (error as any)?.code;
      const retryable =
        code === "OFFLINE" || code === "AUTH_EXPIRED" || code === "PROVIDER_ERROR";
      if (!retryable) throw error;
      this.reset();
      const retried = await this.open();
      return run(retried);
    }
  }

  async list(dir: string): Promise<StoredEntry[]> {
    const page = await this.call((provider) => provider.list(dir));
    return (page.entries ?? []).map((entry) => ({
      name: entry.name,
      size: entry.size,
      dir: entry.kind === "dir",
    }));
  }

  async read(path: string): Promise<Uint8Array> {
    const stream = await this.call((provider) => provider.read(path));
    return readAll(stream);
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    await this.call((provider) =>
      provider.write(path, streamOf(bytes), {
        size: bytes.byteLength,
        overwrite: true,
      }),
    );
  }

  async remove(path: string): Promise<void> {
    await this.call((provider) => provider.remove(path, { recursive: true }));
  }

  async ensureDir(dir: string): Promise<void> {
    const parts = dir.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += `/${part}`;
      try {
        await this.call((provider) => provider.mkdir(current));
      } catch {
        // `mkdir` on an existing directory is the normal case after the first
        // run; the provider reports it as a provider error and the other
        // tools prove the directory is there.
      }
    }
  }

  async exists(path: string): Promise<boolean> {
    const index = path.lastIndexOf("/");
    const parent = index <= 0 ? "/" : path.slice(0, index);
    const name = path.slice(index + 1);
    try {
      const entries = await this.list(parent);
      return entries.some((entry) => entry.name === name);
    } catch {
      return false;
    }
  }

  close() {
    this.reset();
  }
}
