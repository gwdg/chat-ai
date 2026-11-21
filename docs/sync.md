# Encrypted sync over SAIA fs

Status: implemented behind the `sync` module flag (`VITE_MODULE_SYNC`), off by default.

Chat AI keeps all of its data in the browser: conversations, attachments and topics in
Dexie/IndexedDB, preferences in Redux/localStorage, workspaces and agent metadata in further
local tables. This document describes how a user can copy that data to their own SAIA filesystem
and keep several devices in step — without the server ever seeing plaintext.

## 1. Why the design looks like this

The transport is the per-user folder of `saia-fs`, reached through the MCP tools that
`workspace/providers/saiaFs.ts` already speaks:

| Tool | Used for |
| --- | --- |
| `list` / `list_json` | one directory listing per namespace |
| `read_base64` / `write_base64` | binary blobs (the vault, records, assets) |
| `mkdir`, `delete`, `move` | directories, tombstones, housekeeping |

It has **no conditional put, no ETag and no lock**, and every write is a whole file. The design
therefore never overwrites a file that another device could be writing:

* every record revision is a **new, immutable file** whose name carries the revision,
* each device owns exactly one **index fragment** that only it writes,
* the merged view is computed by reading all fragments, so a lost or interrupted write costs at
  most one record revision, never the index.

That removes the classic "two devices clobbered the manifest" failure without needing any
server-side feature.

## 2. What is synced

| Namespace | Unit | Contents |
| --- | --- | --- |
| `conversations` | one per chat | title, settings, persona, folder reference, every message with ids, timestamps and feedback; attachments by content hash |
| `folders` | one per topic | name, icon, colour, pin, order |
| `settings` | one | `user_settings` (memories, groups, MCP servers, E2EE public keys and bindings, preferences) |
| `interface_settings` | one | presentation preferences: theme, conversation sort and grouping, warning dialogs, completed and suppressed tours, usage-in-sidebar |
| `workspaces` | one per workspace | workspace row, sources, mounts, chat/agent links, session links, browser-tree entries and their files (bounded) |
| `agents` | one per agent | the local agent entry (connection, timestamps, pin) plus its cached OpenCode session metadata and histories (bounded) |

`meta-chat` is excluded, exactly as `getExportData()` excludes it: it is generated from summaries
and would otherwise fight itself on every device.

`interface_settings` is merged per key like `user_settings`, but a few keys stay on the device that
owns them and are neither uploaded nor overwritten by a pull: `show_sidebar`, `show_settings`,
`collapsed_topics`, `expanded_agents`, `count_hallucination`, `count_announcement`,
`agree_web_search` (a consent) and `sync_onboarding_dismissed` (each browser gets its own offer).

Device-bound data stays device-bound. A local folder source keeps its `deviceId`, so the other
device shows it as unavailable and does not try to open a handle it cannot have. Passphrases,
the vault key and the Argon2 salt never leave the vault header (see §3) and are never exported.

**Bounded content.** A single attachment or workspace-tree file larger than `MAX_SYNC_FILE_BYTES`
(8 MiB) is not uploaded, and one record uploads at most `MAX_SYNC_FILES_PER_RECORD` (500) files.
The file is left out of the record instead of being replaced by a placeholder: a placeholder would
differ on the other device and make every later sync push the record again. The sync summary names
the skipped files. This is what the "do not sync large files" decision means in practice.

## 3. Cryptography

The user supplies **one passphrase**. It does not encrypt the archive directly: it wraps a long
random vault key.

```
passphrase ──Argon2id(salt, m=64 MiB, t=3, p=1)──▶ KEK
KEK ──AES-256-GCM──▶ wrapped vault key                (stored in vault.json)
vault key ──HKDF-SHA256──▶ blob key, asset key       (per purpose)
key ──AES-256-GCM(iv, AAD)──▶ gzip(payload)          (every record and asset)
```

* **`vault.json`** is the only cleartext file. It holds the protocol version, a random `vaultId`,
  the Argon2 parameters and salt, and the wrapped vault key. None of that is a secret, and it is
  what a second device needs to ask for the passphrase.
* **AAD** binds each blob to its slot: `chatai-sync/v1/record/<namespace>/<id>/<rev>` for
  records, `chatai-sync/v1/asset/<sha256>` for assets and `chatai-sync/v1/index/<deviceId>` for a
  fragment. A blob cannot be moved to another record, another revision or another vault.
* **Changing the passphrase** re-wraps the 32-byte vault key; no record is re-encrypted.
* **Rotating the vault** (new salt, new vault key, new `vaultId`) makes every existing blob
  undecryptable, so it always re-uploads the whole archive. It is the way to revoke a device, and
  the UI says so.
* **Wrong passphrase** is indistinguishable from a damaged file: AES-GCM authentication fails and
  the client reports "this passphrase does not open this vault". Nothing is deleted.
* Argon2id is derived on the **async** implementation so the UI does not freeze. Parameters are
  stored in the header, so a future device uses whatever the vault was created with.
* Nothing is ever uploaded unencrypted. If the crypto is unavailable (no WebCrypto/`CompressionStream`
  is optional, Argon2 always is), sync refuses to start rather than degrading.

Implementation: `src/sync/crypto/` (`vault.ts`, `envelope.ts`, `bytes.ts`) on `@noble/hashes`
(Argon2id, SHA-256, HKDF) and `@noble/ciphers` (AES-GCM) — the same primitives the E2EE transport
uses, but a separate module: E2EE seals requests to a model node with an X25519 published key,
which is a different problem and a different key lifecycle.

## 4. Remote layout

```
/.chat-ai-sync/v1/
  vault.json                                   cleartext header (salt + wrapped vault key)
  index/<deviceId>.bin                         this device's index fragment (encrypted)
  records/<namespace>/<id>.<rev>-<device>.bin  immutable record revision
  assets/<sha256>.bin                          content-addressed attachments and tree files
```

* `<id>` is base64url so any id is a legal file name. `<rev>` is a millisecond timestamp raised to
  at least the previous remote revision + 1, so it always increases; two devices never produce the
  same `<rev>` for one id, and the merged index takes the higher one (ties break on the content
  hash). `<device>` is the first 8 alphanumerics of the writer's device id.
* The **fragment** holds only metadata: `{ v, deviceId, at, records: {"ns:id": {rev, hash,
  deviceId}}, deleted: {"ns:id": at}, devices: {deviceId: lastSeen} }`. Because it carries content
  hashes, a pull downloads only the records whose hash this device does not already have.
* Assets are addressed by the SHA-256 of their **plaintext**, so the same attachment appears once
  even when several chats use it. Equality of a hash is the only thing the naming leaks.
* Garbage collection is explicit ("Clean up remote"): it keeps exactly the revision each merged
  index entry names and deletes every other revision file, then deletes assets that no live
  record references. A normal sync never deletes anything it did not write.

## 5. Merge

Each device keeps a base per record: the `{rev, hash}` it last agreed on
(`sync_records` table, Dexie v18). "Local changed" is a content-hash comparison, never a
timestamp, so a re-saved chat that is byte-identical is not a change, and a clock skew cannot
create one.

For every `(namespace, id)` in the union of local records, base and remote fragments:

| Local | Remote | Action |
| --- | --- | --- |
| unchanged | unchanged | nothing |
| unchanged | newer hash | **pull**: download, decrypt, apply |
| changed | unchanged | **push**: new revision |
| changed | newer + `extend` says it is a superset | **pull** (fast-forward) |
| changed | newer + conflicting | **duplicate**: keep the remote version as a new local record, push the local one |
| deleted locally | unchanged remotely | **tombstone** (kept 90 days, pruned once every known device has synced past it) |
| deleted remotely | unchanged locally | delete locally |
| deleted remotely | changed locally | **resurrect**: the edit is newer, the record is pushed again |

`extend` is only meaningful for conversations: when the remote message list still contains every
local message id, in order, the remote version is an append and can replace the local one. That is
the common case for a chat that continues on another device, and it avoids a conflict copy.

Settings merge three ways per key (base/local/remote). A key changed on one side follows that
side; a key changed on both sides keeps the local value and is reported as a settings conflict, so
no switch silently flips. `memories`, `memory_groups`, `e2ee_keys` and `mcp_servers` are
additionally merged by element id, and `e2ee_models` by map key, so two devices can add entries
without duplicating the list. The last agreed settings payload is kept next to the revision state
(`sync_meta`), because a three-way merge needs a common ancestor.

A workspace record always reaches the tree from the other device, but its browser tree is applied
**additively**: a file the record does not carry (too large, or added locally after the last sync)
is never deleted by a pull, and a duplicated workspace gets a fresh id.

A conflict copy is a normal conversation whose title ends in ` (conflict copy)`; nothing is lost
and no dialog blocks the sync.

## 6. Who runs it

* **Opt-in.** The Data tab of the profile modal gains a *Server synchronization* section. Nothing is written
  until the user reads the encryption note, sets a passphrase and presses *Create encrypted
  copy*. This is stored as `user_settings.sync.enabled`; the passphrase, the vault key and the
  device id are never stored in Redux.
* **One tab at a time.** `navigator.locks.request("chatai-sync")` serialises runs across tabs; a
  second tab receives the same lock and runs afterwards, reading the first tab's fragment.
* **Only the active tab syncs on its own.** The five-minute timer and the catch-up after switching
  back to a tab are skipped while `document.visibilityState` is not `"visible"`, so a hidden tab
  never duplicates a pull or a push. A pass that already runs finishes; catch-up on activation only
  happens when the interval has elapsed since the last run. Explicit *Sync now* and the pass after
  creating or rotating the vault still run from the tab where the button was pressed.
* **Auto-sync** runs every five minutes, but only while the vault key is in memory and only from the
  active tab. Reloading the page locks the vault again.
* **Where the key lives:** a module-level session object, so it is gone on reload and never in
  `localStorage`. A passkey on this device can unlock it after a reload without the passphrase, and
  it is only requested when the key is actually needed: while automatic sync is on, or when *Sync
  now* is pressed while automatic sync is paused. Losing both means entering the passphrase again —
  never losing data.
* **Status** (last sync, conflicts, skipped files, last error) is exposed to the UI. The Meta chat
  sees the two preferences through `get_user_settings` and can propose `sync_enabled` /
  `sync_auto`; it never receives the passphrase or the vault key, and creating or unlocking the
  copy stays in the Data tab. The feature has its own guide (`sync_setup`), which is hidden while
  the module is off.
* **Module gate.** `modules.sync` in `front.json` maps to `VITE_MODULE_SYNC` and is read through
  `utils/modules.js#isSyncEnabled()`. It is opt-in: an absent key means off, the `minimal`
  deployment keeps it off, and the Data section, the guide and the tutorial catalog all disappear
  with it (the guide through `FEATURE_GUIDE_AVAILABILITY`, not only through the catalog).

## 7. Failure handling

| Failure | Behaviour |
| --- | --- |
| `saia-fs` unavailable / no identity | fail closed, nothing written, `AUTH_EXPIRED`/`OFFLINE` surfaced verbatim |
| interrupted upload | the fragment is written last and the local base rows only after it, so a pass that uploaded records but could not publish its fragment is repeated on the next run; a truncated blob fails GCM and is never applied |
| wrong passphrase | GCM failure, no mutation, no oracle |
| two devices push at once | distinct revision files + fragment union |
| missing asset | the record is applied without that file and the summary names it; the file is left out rather than marked missing, so the payload stays hash-stable |
| quota/size | bounded per file by `MAX_SYNC_FILE_BYTES` and per record by `MAX_SYNC_FILES_PER_RECORD` |

## 8. Tests

`front/src/sync/__tests__/`: Argon2 wrap/unwrap/re-wrap and AAD rejection; envelope gzip and
tamper detection; the merge table above against an in-memory store; conversations round-trip
(serialize → encrypt → decrypt → apply) against fake-indexeddb; settings three-way merge;
per-device fragment union and tombstone pruning; the vault lifecycle (create, lock, unlock, change,
rotate, cleanup) against in-memory deps. `modals/UserSettings/__tests__/SyncSettings.test.jsx`
covers the Data-tab section with the module on and off.

Run them with `cd front && npx vitest run src/sync src/modals/UserSettings`.
