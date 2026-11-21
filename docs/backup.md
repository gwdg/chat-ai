# Encrypted backup file

Status: implemented, available in **User settings → Data → Encrypted backup** on every deployment
(no module flag). The Data tab is split into three sections — Manage data, Encrypted backup and
Server synchronization — so the backup is its own screen rather than a block below the export buttons.

A backup is a single downloadable file that carries the browser's history — conversations with
their attachments, topics, user settings, workspaces and agents — encrypted with a passphrase the
user chooses. It is deliberately separate from [encrypted sync](sync.md): sync keeps a live revision
tree on the SAIA filesystem and needs the network, while a backup is one self-contained file the
user can store anywhere and restore later with the same passphrase.

## 1. File format

```
chat-ai-backup-YYYYMMDD-HHmmss.chataibackup        # local date-time in the name
```

The file is JSON so the header can be inspected before the passphrase is asked for. It holds no key
material in the clear:

```jsonc
{
  "format": "chat-ai-backup",
  "version": 1,
  "createdAt": 1763721015000,          // unix ms; also the AAD of the payload
  "appVersion": "2.0.0",               // optional
  "counts": { "records": 42, "assets": 7, "conversations": 30, ... },
  "kdf": { "alg": "argon2id", "t": 3, "m": 65536, "p": 1, "dkLen": 32, "salt": "…" },
  "payload": "…"                        // base64url of the sealed archive
}
```

`payload` is opened with the passphrase and parsed as the archive:

```jsonc
{
  "records": [{ "namespace": "conversations", "id": "…", "hash": "…", "title": "…", "payload": { … } }],
  "assets": { "<sha256>": "<base64url bytes>" },
  "skipped": ["file.pdf (9000000 bytes)"]
}
```

Attachments and workspace-tree files are content-addressed and deduplicated across records, so two
records that refer to the same file store it once.

## 2. Cryptography

The passphrase is **not** the data key. Argon2id (`t=3`, `m=65536` KiB, `p=1`, 32-byte output)
derives a key-encryption key, HKDF (`chatai-backup/v1`, info `backup`) turns it into a 32-byte
backup key, and the archive is sealed with AES-256-GCM through the same `CASSYNC1` envelope the sync
module uses: magic | flags | 12-byte IV | ciphertext, optional gzip, and an AAD that names the slot
(`chatai-backup/v1/<createdAt>`). Changing `createdAt` or splicing one file's payload into another
fails authentication.

The salt is random per backup and stored in the header, so the same passphrase produces a different
key for every file. Neither the passphrase nor the derived key is persisted anywhere; a reload asks
for the passphrase again on the next restore. The KDF parameters are read from the header but
bounded (`m ≤ 1 MiB`, `t ≤ 10`, `p ≤ 4`) so a hostile file cannot make the browser hang.

The passphrase policy is the sync policy: at least 10 characters (`MIN_BACKUP_PASSPHRASE_LENGTH`).
No password is ever written to the package, Redux, localStorage or IndexedDB.

## 3. What is in it

The archive is built from the same namespaces as sync (`createDefaultNamespaces()`), so "the whole
history" has exactly one definition:

| Namespace | Unit | Contents |
| --- | --- | --- |
| `settings` | one | `user_settings` (preferences, memories and groups, MCP servers, E2EE public keys and bindings) |
| `folders` | one per topic | name, icon, colour, pin, order |
| `workspaces` | one per workspace | workspace row, sources, mounts, chat/agent/session links, browser-tree entries and files |
| `agents` | one per agent | local agent entry plus cached OpenCode session metadata and histories (bounded) |
| `conversations` | one per chat | title, settings, persona, topic reference, every message with ids, timestamps and feedback; attachments by content hash |

`meta-chat` is excluded, exactly like the plain JSON export: it is derived from the other chats.

The same limits as sync apply: a file larger than 8 MiB (`MAX_SYNC_FILE_BYTES`) is left out, one
record carries at most 500 files (`MAX_SYNC_FILES_PER_RECORD`), and an agent record drops session
histories rather than growing without bound. Skipped files are listed in the package and in the UI;
they are **not** replaced by placeholders.

A backup is encrypted, so it contains whatever `user_settings` contains, including MCP server
headers when the user configured them. Treat the file as a secret even though it is encrypted.

## 4. Restore

`restoreBackup(text, passphrase)` opens the package and replays every record through
`SyncNamespace.apply`, in namespace order (`settings` → `folders` → `workspaces` → `agents` →
`conversations`). This is the same write path as a sync pull:

* existing rows with the same id are overwritten (`updateConversation(…, true)` for chats, `db.put`
  for workspace bundles, `importUserSettings` for settings);
* nothing is deleted;
* assets are read from the package's `assets` map; a missing blob is reported as skipped;
* a namespace this build does not know is named in `unknownNamespaces` instead of being guessed
  at, so a file written by a newer version does not silently lose data.

The UI asks for an explicit confirmation checkbox before restoring, because matching items are
overwritten. Restoration does not need the sync module, a SAIA account or the network.

## 5. Tests

`front/src/backup/__tests__/backup.test.ts` covers the round trip with attachments, the wrong
passphrase, a tampered payload, an unknown namespace, skipped files, the passphrase minimum and the
dated file name. `front/src/modals/UserSettings/__tests__/BackupSettings.test.jsx` covers the UI
flow (create, mismatch, inspect, confirm-before-restore, invalid file).
`front/src/modals/UserSettings/__tests__/DataSettings.test.jsx` covers the section strip, the
deep-link section and the hidden Server synchronization section when the sync module is off. Tests use cheap
Argon2id parameters; the production defaults stay at the values above.
