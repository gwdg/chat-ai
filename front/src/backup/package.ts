import { fromBytes, fromBase64Url, toBase64Url, toBytes } from "../sync/crypto/bytes";
import { hashPayload } from "../sync/canonical";
import { createDefaultNamespaces } from "../sync/namespaces";
import type { SyncAsset, SyncNamespace } from "../sync/types";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  assertBackupPassphrase,
  openBackupPayload,
  parseBackupContainer,
  sealBackupPayload,
  type BackupContainer,
  type BackupKdf,
} from "./crypto";

/**
 * One encrypted file that carries the browser's history: conversations with
 * their attachments, topics, user settings, workspaces and agents.
 *
 * The archive is built from the same namespaces the sync engine uses, so a
 * backup and a remote copy always agree on what "the whole history" means and a
 * restore goes through exactly the same write path. The difference is the
 * encryption: a backup is a single self-contained file encrypted directly with
 * the passphrase, not a revision tree under a vault.
 *
 * `meta-chat` is excluded by the conversations namespace, like the plain JSON
 * export excludes it.
 */

export const BACKUP_EXTENSION = "chataibackup";

export type BackupRecord = {
  namespace: string;
  id: string;
  hash?: string;
  title?: string;
  payload: any;
};

export type BackupArchive = {
  records: BackupRecord[];
  /** Plaintext SHA-256 → base64url bytes, shared by every record. */
  assets: Record<string, string>;
  /** Files the archive had to leave out (too large, unreadable). */
  skipped: string[];
};

export type BackupInfo = {
  createdAt: number;
  appVersion?: string;
  counts: Record<string, number>;
};

export type BackupResult = BackupInfo & {
  text: string;
  fileName: string;
  records: number;
  assets: number;
  skipped: string[];
};

export type RestoreResult = {
  createdAt: number;
  records: number;
  applied: Record<string, number>;
  skipped: string[];
  unknownNamespaces: string[];
};

export type CreateBackupOptions = {
  namespaces?: SyncNamespace[];
  now?: number;
  appVersion?: string;
  /** Tests pass cheap Argon2id settings; never set this in the UI. */
  argon?: Partial<Omit<BackupKdf, "salt">>;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Local-time stamp, so the name matches the date the user sees in the UI. */
export const backupFileName = (createdAt: number): string => {
  const date = new Date(createdAt);
  return [
    "chat-ai-backup-",
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    "-",
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
    `.${BACKUP_EXTENSION}`,
  ].join("");
};

const collectAssets = (
  assets: Map<string, string>,
  recordAssets: SyncAsset[] | undefined,
) => {
  for (const asset of recordAssets ?? []) {
    // `ArrayBuffer.isView`, not `instanceof`: assets can come from another
    // realm (a worker, jsdom) and are still plain bytes.
    if (!asset?.sha256 || !ArrayBuffer.isView(asset.bytes)) continue;
    if (assets.has(asset.sha256)) continue;
    assets.set(asset.sha256, toBase64Url(asset.bytes as Uint8Array));
  }
};

export async function createBackup(
  passphrase: string,
  options: CreateBackupOptions = {},
): Promise<BackupResult> {
  assertBackupPassphrase(passphrase);
  const createdAt = options.now ?? Date.now();
  const namespaces = options.namespaces ?? createDefaultNamespaces();
  const records: BackupRecord[] = [];
  const assets = new Map<string, string>();
  const skipped: string[] = [];
  const counts: Record<string, number> = {};

  for (const namespace of namespaces) {
    const localRecords = await namespace.list();
    counts[namespace.name] = localRecords.length;
    for (const record of localRecords) {
      records.push({
        namespace: record.namespace,
        id: record.id,
        ...(record.hash ? { hash: record.hash } : {}),
        ...(record.title ? { title: record.title } : {}),
        payload: record.payload,
      });
      collectAssets(assets, record.assets);
    }
    skipped.push(...(namespace.takeSkipped?.() ?? []));
  }

  const archive: BackupArchive = {
    records,
    assets: Object.fromEntries(assets),
    skipped,
  };
  const plaintext = toBytes(JSON.stringify(archive));
  const { kdf, payload } = await sealBackupPayload(passphrase, createdAt, plaintext, {
    argon: options.argon,
  });
  const container: BackupContainer = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    ...(options.appVersion ? { appVersion: options.appVersion } : {}),
    counts: {
      records: records.length,
      assets: assets.size,
      ...counts,
    },
    kdf,
    payload,
  };

  return {
    text: JSON.stringify(container, null, 2),
    fileName: backupFileName(createdAt),
    createdAt,
    appVersion: options.appVersion,
    counts: container.counts ?? {},
    records: records.length,
    assets: assets.size,
    skipped,
  };
}

/** Read the cleartext header, e.g. to show the date before asking for a passphrase. */
export function inspectBackup(text: string): BackupInfo {
  const container = parseBackupContainer(text);
  return {
    createdAt: container.createdAt,
    appVersion: container.appVersion,
    counts: container.counts ?? {},
  };
}

const parseArchive = (plaintext: Uint8Array): BackupArchive => {
  let value: any;
  try {
    value = JSON.parse(fromBytes(plaintext));
  } catch {
    throw new BackupError("INVALID_BACKUP", "The backup content is not readable.");
  }
  if (!value || !Array.isArray(value.records)) {
    throw new BackupError("INVALID_BACKUP", "The backup content is not readable.");
  }
  const assets: Record<string, string> = {};
  for (const [sha256, bytes] of Object.entries(value.assets ?? {})) {
    if (typeof sha256 === "string" && typeof bytes === "string") {
      assets[sha256] = bytes;
    }
  }
  return {
    records: value.records.filter(
      (record: any) => record && typeof record.namespace === "string",
    ),
    assets,
    skipped: Array.isArray(value.skipped)
      ? value.skipped.filter((entry: any) => typeof entry === "string")
      : [],
  };
};

/** Decrypt and validate a package without writing anything. */
export async function openBackup(
  text: string,
  passphrase: string,
): Promise<{ container: BackupContainer; archive: BackupArchive }> {
  const container = parseBackupContainer(text);
  const plaintext = await openBackupPayload(passphrase, container);
  return { container, archive: parseArchive(plaintext) };
}

export type RestoreBackupOptions = {
  namespaces?: SyncNamespace[];
};

/**
 * Merge a package into this browser. Existing rows with the same id are
 * overwritten, nothing is deleted, and namespaces are applied in the same order
 * as a sync (`settings` first, so a restored setting is in place before chats
 * need it). Unknown namespaces are reported instead of guessed at.
 */
export async function restoreBackup(
  text: string,
  passphrase: string,
  options: RestoreBackupOptions = {},
): Promise<RestoreResult> {
  const { container, archive } = await openBackup(text, passphrase);
  const namespaces = options.namespaces ?? createDefaultNamespaces();
  const known = new Set(namespaces.map((namespace) => namespace.name));
  const skipped = [...archive.skipped];
  const applied: Record<string, number> = {};

  const readAsset = async (sha256: string): Promise<Uint8Array | null> => {
    const encoded = archive.assets[sha256];
    if (!encoded) return null;
    try {
      return fromBase64Url(encoded);
    } catch {
      return null;
    }
  };
  const context = {
    readAsset,
    now: Date.now(),
    deviceId: "backup",
  };

  for (const namespace of namespaces) {
    const records = archive.records.filter(
      (record) => record.namespace === namespace.name,
    );
    for (const record of records) {
      await namespace.apply(
        {
          namespace: namespace.name,
          id: String(record.id ?? ""),
          rev: 0,
          hash: record.hash ?? hashPayload(record.payload),
          payload: record.payload,
          deviceId: "backup",
        },
        context,
      );
      applied[namespace.name] = (applied[namespace.name] ?? 0) + 1;
    }
    skipped.push(...(namespace.takeSkipped?.() ?? []));
  }

  const unknownNamespaces = [
    ...new Set(
      archive.records
        .map((record) => record.namespace)
        .filter((name) => !known.has(name)),
    ),
  ];

  return {
    createdAt: container.createdAt,
    records: archive.records.length,
    applied,
    skipped,
    unknownNamespaces,
  };
}
