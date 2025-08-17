import Dexie, { Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useEffect, useState } from 'react'
import {v4 as uuidv4} from 'uuid';

// ---------- Types ----------

export type MessageRole = 'user' | 'assistant' | 'system' | 'info'

export type ModelSpec = {
  id: string
  name: string
  input: string[]
  output: string[]
  // you can add more fields as needed
  [k: string]: any
}

export type ConversationSettings = {
  model: ModelSpec
  temperature: number
  top_p: number
  memory: number
  enable_tools: boolean
  tools: any[]
  arcana: Record<string, any>
  // store as plain JSON; Dexie can persist it
}

export type ConversationRow = {
  id: string // uuid
  title: string
  createdAt: number
  lastModified: number
  settings: ConversationSettings
  messageCount: number
}

type MessageRow = {
  id: string
  conversationId: string
  idx: number
  role: MessageRole
  content: ContentItem[] // stored normalized items
  createdAt: number
  updatedAt?: number
  meta?: any
}

export type MessageInput = {
  id?: string
  idx: number
  role: MessageRole
  content: ContentItem[]
  files?: FileInput[]
  createdAt?: number
  updatedAt?: number
  meta?: any
}

export type ContentItem = {
  type: 'text' | 'image' | 'file'
  data: string | Blob
}

export type ContentItemInput = {
  type: 'text' | 'image' | 'file'
  data: string | Blob
}

export type FileMetaRow = {
  id: string // uuid; shared with FileDataRow
  conversationId: string
  messageId: string
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  duration?: number
  extra?: any
}

export type FileDataRow = {
  id: string // same as FileMetaRow.id
  data: Blob // actual binary
}

// For returning messages with file placeholders (no Blob)
export type FilePlaceholder = Omit<FileMetaRow, 'conversationId' | 'messageId'>
export type HydratedMessage = Omit<MessageRow, 'fileIds'> & { files: FilePlaceholder[] }

// For writes
export type FileInput =
  | ({ id: string } & Partial<FilePlaceholder>) // existing file reference by id; optional meta updates
  | ({
      id?: undefined
      name: string
      mimeType: string
      size: number
      data: Blob
      width?: number
      height?: number
      duration?: number
      extra?: any
    })



// ---------- Utilities ----------

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Simple fallback
  return uuidv4();
}

// ---------- Dexie DB ----------

export class AppDB extends Dexie {
  conversations!: Table<ConversationRow, string>
  messages!: Table<MessageRow, string>
  files_meta!: Table<FileMetaRow, string>
  files_data!: Table<FileDataRow, string>

  constructor() {
    super('app-conversations-db')
    // Indexes:
    // - conversations: order by lastModified quickly; search by title if needed
    // - messages: fast range queries by conversation + idx
    // - files_meta: link to conversation/message; fast lookup per conversation
    // - files_data: keyed by id
    this.version(1).stores({
      conversations: 'id, lastModified, createdAt, title',
      messages: 'id, conversationId, [conversationId+idx], idx, createdAt',
      files_meta: 'id, conversationId, messageId, mimeType, size, name',
      files_data: 'id',
    })
  }
}

export const db = new AppDB()

// ---------- Low-level helpers ----------

async function hydrateConversation(conversationId: string) {
  const convo = await db.conversations.get(conversationId)
  if (!convo) return null

  const messages = await db.messages
    .where('[conversationId+idx]')
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .sortBy('idx') // ensures order

  // Fetch all file meta for this conversation once
  const fileMeta = await db.files_meta.where('conversationId').equals(conversationId).toArray()
  const filesById = new Map(fileMeta.map((f) => [f.id, f]))

  const hydratedMessages: HydratedMessage[] = messages.map((m) => ({
    id: m.id,
    conversationId,
    idx: m.idx,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    meta: m.meta,
  }))
  return ({ ...convo, messages: hydratedMessages })
}

// Insert file meta+data; returns the new id
async function insertFile(conversationId: string, messageId: string, f: Exclude<FileInput, { id: string }>) {
  const id = newId()
  const meta: FileMetaRow = {
    id,
    conversationId,
    messageId,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    width: f.width,
    height: f.height,
    duration: f.duration,
    extra: f.extra,
  }
  const data: FileDataRow = { id, data: f.data }
  await db.files_meta.add(meta)
  await db.files_data.add(data)
  return id
}

// Upsert existing file meta (does not modify data/blob)
async function upsertFileMeta(partial: { id: string } & Partial<FileMetaRow>) {
  const { id, ...rest } = partial
  if (!id) return
  if (Object.keys(rest).length === 0) return
  await db.files_meta.update(id, rest)
}

// ---------- Public API ----------

// Create a new conversation with optional initial settings and messages
export async function createConversation(params: {
  title?: string
  settings: ConversationSettings
  messages?: MessageInput[]
}) {
  const id = newId()
  const now = Date.now()
  const title = params.title
  const settings = params.settings
  const messages = params.messages

  await db.transaction('rw', db.conversations, db.messages, db.files_meta, db.files_data, async () => {
    await db.conversations.add({
      id,
      title,
      createdAt: now,
      lastModified: now,
      settings,
      messageCount: 0,
    })

    if (messages.length > 0) {
      await updateConversation(id, { title, settings, messages })
    }
  })

  return id
}

// Get minimal list for sidebar
export async function listConversationMetas(): Promise<
  Array<Pick<ConversationRow, 'id' | 'title' | 'createdAt' | 'lastModified' | 'messageCount'>>
> {
  return db.conversations.orderBy('id').toArray()
}

// Get one conversation fully hydrated (messages + file placeholders)
export async function getConversation(conversationId: string) {
  return hydrateConversation(conversationId)
}

// Replace the entire content (title/settings/messages) of a conversation in one go.
// Good fit for your "debounced save" pattern.
export async function updateConversation(
  conversationId: string,
  data: {
    title?: string
    settings?: ConversationSettings
    messages: Array<{
      id?: string
      idx: number
      role: MessageRole
      content: ContentItemInput[] | string
      createdAt?: number
      updatedAt?: number
      meta?: any
    }>
  }
) {
  const now = Date.now()
  await db.transaction('rw', db.conversations, db.messages, db.files_meta, db.files_data, async () => {
    const convo = await db.conversations.get(conversationId)
    if (!convo) throw new Error('Conversation not found')

    // Build message inputs with ids
    const normalizedMsgs: Required<Pick<MessageInput, 'id' | 'idx' | 'role' | 'text'>> &
      Omit<MessageInput, 'id'>[] = data.messages.map((m, index) => ({
      id: m.id ?? newId(),
      idx: m.idx ?? index,
      role: m.role,
      content: m.content ?? [],
      files: m.files ?? [],
      createdAt: m.createdAt ?? now,
      updatedAt: m.updatedAt,
      meta: m.meta,
    }))

    // Delete messages (and their files) that are not in the new set
    const keepIds = new Set(normalizedMsgs.map((m) => m.id))
    const existingMsgIds = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .primaryKeys()

    const toDeleteMsgIds = existingMsgIds.filter((id) => !keepIds.has(id))
    if (toDeleteMsgIds.length) {
      // Delete orphan files first
      const orphanFileIds = await db.files_meta
        .where('messageId')
        .anyOf(toDeleteMsgIds)
        .primaryKeys()
      if (orphanFileIds.length) {
        await db.files_data.bulkDelete(orphanFileIds)
        await db.files_meta.bulkDelete(orphanFileIds)
      }
      await db.messages.bulkDelete(toDeleteMsgIds)
    }
    // Upsert messages and attach files
    // Also add idx from index in list
    for (const m of normalizedMsgs) {
      // resolve fileIds
    //   const desiredFileIds: string[] = []
        
    //   for (const f of m.files ?? []) {
    //     if ('id' in f && f.id) {
    //       desiredFileIds.push(f.id)
    //       // Optionally update meta
    //       await upsertFileMeta({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, width: f.width, height: f.height, duration: f.duration, extra: f.extra })
    //     } else {
    //       const fnew = f as Exclude<FileInput, { id: string }>
    //       const newIdForFile = await insertFile(conversationId, m.id!, fnew)
    //       desiredFileIds.push(newIdForFile)
    //     }
    //   }
        const processedContent: ContentItem[] = []
        if (typeof m.content === 'string') {
            processedContent.push({ type: 'text', data: m.content });
        }
        else { // Content is list
            for (const item of m.content) {
                // If type is string then make it a text item
                if (typeof item === 'string') {
                    processedContent.push({ type: 'text', data: item })
                }
                // Handle other content types
                if (!item || typeof item !== 'object' || !('type' in item)) continue
                if (item.type === 'text' || item.type === 'image' || item.type === 'file') {
                    processedContent.push({ type: item.type, data: item.data })
                } else {
                    console.log("Error: unknown message content type: ", item.type)
                }
            // TODO replace large files with file handler
          }
        }
      const msgRow: MessageRow = {
        id: m.id!,
        conversationId,
        idx: m.idx,
        role: m.role,
        content: processedContent,
        createdAt: m.createdAt ?? now,
        updatedAt: now,
        meta: m.meta,
      }
      await db.messages.put(msgRow)
    }
    await db.conversations.update(conversationId, {
      title: data.title ?? convo.title,
      settings: data.settings ?? convo.settings,
      lastModified: now,
      messageCount: normalizedMsgs.length,
    })
  })
}

// Add a single message (returns its id)
// export async function addMessage(conversationId: string, message: MessageInput): Promise<string> {
//   const now = Date.now()
//   const id = message.id ?? newId()

//   await db.transaction('rw', db.messages, db.files_meta, db.files_data, db.conversations, async () => {
//     // Insert files first
//     const fileIds: string[] = []
//     for (const f of message.files ?? []) {
//       if ('id' in f && f.id) {
//         fileIds.push(f.id)
//         await upsertFileMeta({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, width: f.width, height: f.height, duration: f.duration, extra: f.extra })
//       } else {
//         const fnew = f as Exclude<FileInput, { id: string }>
//         const fid = await insertFile(conversationId, id, fnew)
//         fileIds.push(fid)
//       }
//     }

//     await db.messages.add({
//       id,
//       conversationId,
//       idx: message.idx,
//       role: message.role,
//       text: message.text,
//       fileIds,
//       createdAt: message.createdAt ?? now,
//       updatedAt: now,
//       meta: message.meta,
//     })

//     const convo = await db.conversations.get(conversationId)
//     if (convo) {
//       await db.conversations.update(conversationId, {
//         lastModified: now,
//         messageCount: (convo.messageCount ?? 0) + 1,
//       })
//     }
//   })

//   return id
// }

// Update a message (text, role, idx, files meta references)
// export async function updateMessage(messageId: string, updates: Partial<Omit<MessageRow, 'id' | 'conversationId' | 'createdAt'>>) {
//   const now = Date.now()
//   await db.transaction('rw', db.messages, db.conversations, async () => {
//     const msg = await db.messages.get(messageId)
//     if (!msg) return
//     const next = { ...updates, updatedAt: now }
//     await db.messages.update(messageId, next)

//     await db.conversations.update(msg.conversationId, { lastModified: now })
//   })
// }

// Delete a message and its files
// export async function deleteMessage(messageId: string) {
//   await db.transaction('rw', db.messages, db.files_meta, db.files_data, db.conversations, async () => {
//     const msg = await db.messages.get(messageId)
//     if (!msg) return
//     if (msg.fileIds.length) {
//       await db.files_data.bulkDelete(msg.fileIds)
//       await db.files_meta.bulkDelete(msg.fileIds)
//     }
//     await db.messages.delete(messageId)

//     const convo = await db.conversations.get(msg.conversationId)
//     if (convo) {
//       await db.conversations.update(msg.conversationId, {
//         lastModified: Date.now(),
//         messageCount: Math.max(0, (convo.messageCount ?? 1) - 1),
//       })
//     }
//   })
// }

// Rename conversation or update settings
export async function updateConversationMeta(
  conversationId: string,
  updates: Partial<Pick<ConversationRow, 'title' | 'settings'>>
) {
  await db.conversations.update(conversationId, { ...updates, lastModified: Date.now() })
}

// Delete entire conversation (messages + files)
export async function deleteConversation(conversationId: string) {
  await db.transaction('rw', db.messages, db.files_meta, db.files_data, db.conversations, async () => {
    const fileIds = await db.files_meta.where('conversationId').equals(conversationId).primaryKeys()
    if (fileIds.length) {
      await db.files_data.bulkDelete(fileIds)
      await db.files_meta.bulkDelete(fileIds)
    }
    await db.messages.where('conversationId').equals(conversationId).delete()
    await db.conversations.delete(conversationId)
  })
}

// File APIs
export async function getFileMeta(fileId: string) {
  return db.files_meta.get(fileId)
}

export async function getFileData(fileId: string) {
  const row = await db.files_data.get(fileId)
  return row?.data ?? null
}

export async function getFileObjectURL(fileId: string) {
  const blob = await getFileData(fileId)
  return blob ? URL.createObjectURL(blob) : null
}

// Maintenance
export async function resetDB() {
  await db.delete()
  // Recreate instance (Dexie deletes the database but not the in-memory schema)
  ;(db as any)['_state']?.db?.close?.()
  ;(db as any).open?.()
}

// ---------- React hooks ----------

// Debounce utility
function debounce<T extends (...args: any[]) => any>(fn: T, wait = 1000) {
  let t: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      t = null
      fn(...args)
    }, wait)
  }
}

// 1) Hook to load a full conversation (messages + file placeholders)
// Returns a plain JS object you can copy into your local component state.
// Also returns a debounced save function that accepts the same shape back.
// export function useConversation(conversationId: string | undefined) {
//   const live = useLiveQuery(
//     async () => {
//       if (!conversationId) return null
//       return await hydrateConversation(conversationId)
//     },
//     [conversationId],
//     null
//   )

//   const loading = !live && !!conversationId

//   const save = useCallback(
//     async (next: {
//       id: string
//       title: string
//       settings: ConversationSettings
//       messages: Array<{
//         id?: string
//         idx: number
//         role: MessageRole
//         text: string
//         files?: FileInput[]
//         createdAt?: number
//         updatedAt?: number
//         meta?: any
//       }>
//     }) => {
//       await replaceConversation(next.id, {
//         title: next.title,
//         settings: next.settings,
//         messages: next.messages,
//       })
//     },
//     []
//   )

//   const saveDebounced = useMemo(() => debounce(save, 1000), [save])

//   return {
//     data: live, // { conversation, messages } | null
//     loading,
//     save,
//     saveDebounced,
//     refresh: async () => {
//       if (conversationId) {
//         // no-op: useLiveQuery will auto-refresh on DB changes
//         // but you can force a re-read by touching a no-op read:
//         await db.conversations.get(conversationId)
//       }
//     },
//   }
// }

// 2) Hook to list conversation metas for a sidebar
export function useConversationList() {
  const list = useLiveQuery(
    async () => {
      const rows = await db.conversations.orderBy('createdAt').reverse().toArray()
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: r.createdAt,
        lastModified: r.lastModified,
        messageCount: r.messageCount,
      }))
    },
    [],
    [] as Array<{ id: string; title: string; createdAt: number; lastModified: number; messageCount: number }>
  )
  return list
}

// 3) Helper to fetch file Blob on demand (lazy loading)
export function useFileLoader() {
  const loadMeta = useCallback((fileId: string) => getFileMeta(fileId), [])
  const loadData = useCallback((fileId: string) => getFileData(fileId), [])
  const loadObjectURL = useCallback((fileId: string) => getFileObjectURL(fileId), [])
  return { loadMeta, loadData, loadObjectURL }
}