import Dexie, { Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useEffect, useState } from 'react'
import {v4 as uuidv4} from 'uuid';

import type { 
  ConversationRow, 
  MessageRow, 
  ContentItemRow, 
  FileMetaRow, 
  FileDataRow, 
  HydratedMessage,
  ConversationSettings,
  MessageInput,
  MessageRole,
  ContentItemInput
} from "./dbTypes"

// ---------- Dexie DB ----------

export class AppDB extends Dexie {
  conversations!: Table<ConversationRow, string>
  messages!: Table<MessageRow, string>
  content_items!: Table<ContentItemRow, string>
  files_meta!: Table<FileMetaRow, string>
  files_data!: Table<FileDataRow, string>

  constructor() {
    super('app-conversations-db')
    // Indexes:
    // - conversations: order by lastModified quickly; search by title if needed
    // - messages: fast range queries by conversation + idx
    // - files_meta: link to conversation/message; fast lookup per conversation
    // - files_data: keyed by id
    this.version(2).stores({
      conversations: 'id, lastModified, createdAt, title',
      messages: 'id, conversationId, [conversationId+idx], idx, createdAt',
      content_items: 'id, messageId, [messageId+idx], idx, type',
      files_meta: 'id, conversationId, messageId, type, size, name',
      files_data: 'id',
    })
  }
}

export const db = new AppDB()

// ---------- Utilities ----------

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Simple fallback
  return uuidv4();
}



// ---------- Low-level helpers ----------

async function hydrateConversation(conversationId: string) {
  // Get conversation
  const convo = await db.conversations.get(conversationId)
  if (!convo) return null

  // Get all messages ordered by idx
  const messages = await db.messages
    .where('[conversationId+idx]')
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .sortBy('idx')

  // Get all message IDs
  const messageIds = messages.map(m => m.id)

  // Get all content items for those messages, ordered within messages
  const allContentItems = await db.content_items
    .where('messageId')
    .anyOf(messageIds)
    .sortBy('idx')

  // Get all file IDs referenced by content items
  const fileIds = allContentItems
    .filter(ci => ci.type === 'file' && ci.fileId)
    .map(ci => ci.fileId!)

  // Fetch file meta for those files
  const fileMetaRows = fileIds.length > 0
    ? await db.files_meta.where('id').anyOf(fileIds).toArray()
    : []

  const filesById = new Map(fileMetaRows.map(f => [f.id, f]))

  // Group content items by messageId
  const contentByMessage = new Map<string, any[]>()
  for (const ci of allContentItems) {
    let items = contentByMessage.get(ci.messageId)
    if (!items) {
      items = []
      contentByMessage.set(ci.messageId, items)
    }
    if (ci.type === 'text') {
      items.push({
        type: 'text',
        text: ci.text ?? ''
      })
    }
    else if (ci.type === 'file') {
      // const meta = filesById.get(ci.fileId!)
      // if (meta) {
      //   // Placeholder with meta only
      //   items.push({
      //     type: 'file',
      //     fileId: meta.id,
      //     file: {
      //       name: meta.name,
      //       type: meta.type,
      //       size: meta.size,
      //       width: meta.width,
      //       height: meta.height,
      //       duration: meta.duration,
      //       extra: meta.extra
      //     }
      //   })
      // } else {
        // File meta missing
      items.push({
        type: 'file',
        fileId: ci.fileId,
      })
    }
  }

  // Build hydrated messages
  const hydratedMessages: HydratedMessage[] = messages.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    idx: m.idx,
    role: m.role,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    meta: m.meta,
    content: contentByMessage.get(m.id) || []
  }))

  return {
    ...convo,
    messages: hydratedMessages
  }
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

  await db.transaction('rw', db.conversations, db.messages, db.content_items, db.files_meta, db.files_data, async () => {
    await db.conversations.add({
      id,
      title,
      createdAt: now,
      lastModified: now,
      settings,
      messageCount: 0,
    })

    if (messages.length > 0) {
      await updateConversation(id, { title, settings, messages }, true)
    }
  })

  return id
}

// Get one conversation fully hydrated (messages + file placeholders)
export async function getConversation(conversationId: string) {
  return hydrateConversation(conversationId)
}

export async function getConversationLastModified(conversationId: string) {
  // Find conversation
  const convo = await db.conversations.get(conversationId);
  return convo?.lastModified || 0;
}

// Replace the entire content (title/settings/messages) of a conversation in one go.
export async function updateConversation(
  conversationId: string,
  data: {
    title?: string
    settings?: ConversationSettings
    messages: Array<{
      id?: string
      idx: number
      role: MessageRole
      content: ContentItemInput[] | string // text or content array
      createdAt?: number
      updatedAt?: number
      meta?: any
    }>,
    lastModified?: number,
  },
  force: boolean = false,
) {
  if (!force) {
    // Soft change, check lastModified
    const lastModifiedDB = (await getConversationMeta(conversationId)).lastModified;
    if (lastModifiedDB !== data?.lastModified) {
      // Conflict detected
      return -1;
    }
  }
  const now = Date.now();
  await db.transaction(
    'rw',
    db.conversations,
    db.messages,
    db.content_items,
    db.files_meta,
    db.files_data,
    async () => {
      const convo = await db.conversations.get(conversationId);
      if (!convo) throw new Error('Conversation not found');

      // Normalize incoming messages (ensure IDs)
      const normalizedMsgs = data.messages.map((m, index) => ({
        id: m.id ?? newId(),
        idx: m.idx ?? index,
        role: m.role,
        content: m.content ?? [],
        createdAt: m.createdAt ?? now,
        updatedAt: m.updatedAt,
        meta: m.meta
      }));

      

      // Figure out message IDs to keep / delete
      const keepIds = new Set(normalizedMsgs.map(m => m.id));
      const existingMsgIds = await db.messages
        .where('conversationId')
        .equals(conversationId)
        .primaryKeys();

      const toDeleteMsgIds = existingMsgIds.filter(id => !keepIds.has(id));

      if (toDeleteMsgIds.length) {
        // Delete all content items for these messages
        await db.content_items.where('messageId').anyOf(toDeleteMsgIds).delete();

        // // Delete orphan files (meta + data)
        // const orphanFileIds = await db.files_meta
        //   .where('messageId')
        //   .anyOf(toDeleteMsgIds)
        //   .primaryKeys();

        // if (orphanFileIds.length) {
        //   await db.files_data.bulkDelete(orphanFileIds);
        //   await db.files_meta.bulkDelete(orphanFileIds);
        // }

        // Delete the messages themselves
        await db.messages.bulkDelete(toDeleteMsgIds);
      }

      // Now upsert each message and insert new content items
      for (const m of normalizedMsgs) {
        // Upsert message row (no content field)
        const msgRow: MessageRow = {
          id: m.id,
          conversationId,
          idx: m.idx,
          role: m.role,
          createdAt: m.createdAt,
          updatedAt: now,
          meta: m.meta
        };
        await db.messages.put(msgRow);

        // Delete old content items for this message before inserting new ones
        await db.content_items.where('messageId').equals(m.id).delete();

        // Build & insert new content items
        const contentArray: ContentItemInput[] =
        m.content as ContentItemInput[];

        let ciIdx = 0;
        for (const item of contentArray) {
          if (item.type === 'text') {
            // Simple text content item
            const ci: ContentItemRow = {
              id: newId(),
              messageId: m.id,
              idx: ciIdx++,
              type: 'text',
              text: typeof item.text === 'string' ? item.text : String(item.text)
            };
            await db.content_items.add(ci);
          }
          else if (item.type === 'file') {
            //let fileId = newId(); // Get new file ID
            //console.log("New file ", fileId);
            // if (item?.file) {
            //   // If item has data, store in files data and meta tables
            //   await db.files_data.add({ id: fileId, data: item.file.data });
            //   await db.files_meta.add({
            //     id: fileId,
            //     conversationId,
            //     messageId: m.id,
            //     name: (item.file as any).name ?? 'file', // name might need to be passed separately
            //     type: item.file.type || 'application/octet-stream',
            //     size: item.file.size,
            //   });
            // } else if (item?.fileId) {
              // If item refers to existing file, simply add
              //fileId = item.fileId;
            //}

            // Add content item referencing fileId
            await db.content_items.add({
              id: newId(),
              messageId: m.id,
              idx: ciIdx++,
              type: 'file',
              fileId: item.fileId
            });
          }
          else {
            console.warn('Unknown content item type: ', item);
          }
        }
      }

      // Finally update conversation info
      await db.conversations.update(conversationId, {
        title: data.title ?? convo.title,
        settings: data.settings ?? convo.settings,
        lastModified: now
      });
    }
  );
  return now;
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
//         await upsertFileMeta({ id: f.id, name: f.name, type: f.type, size: f.size, width: f.width, height: f.height, duration: f.duration, extra: f.extra })
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

// ---------- Conversation List ----------

export async function getLastModifiedConversationMeta(): Promise<ConversationRow | undefined> {
  const conversations = await db.conversations.orderBy('lastModified').reverse().toArray();
  return conversations[0];
}

export async function getConversationMeta(conversationId: string): Promise<ConversationRow | undefined> {
  return await db.conversations.get(conversationId);
}

// Get list of conversation Metas
export async function listConversationMetas(): Promise<
  Array<Pick<ConversationRow, 'id' | 'title' | 'createdAt' | 'lastModified' | 'messageCount'>>
> {
  return db.conversations.orderBy('id').toArray()
}

// Rename conversation or update settings
export async function updateConversationMeta(
  conversationId: string,
  updates: Partial<Pick<ConversationRow, 'title' | 'settings'>>,
) {
  //const now = Date.now();
  await db.conversations.update(conversationId, { ...updates })
  return 0;
}

// Delete entire conversation (messages + content items + files)
export async function deleteConversation(conversationId: string) {
  await db.transaction(
    'rw',
    db.messages,
    db.content_items,
    db.files_meta,
    db.files_data,
    db.conversations,
    async () => {
      // Delete all files for this conversation (meta + data)
      const fileIds = await db.files_meta
        .where('conversationId')
        .equals(conversationId)
        .primaryKeys();

      if (fileIds.length) {
        await db.files_data.bulkDelete(fileIds);
        await db.files_meta.bulkDelete(fileIds);
      }

      // Find all message IDs from this conversation
      const messageIds = await db.messages
        .where('conversationId')
        .equals(conversationId)
        .primaryKeys();

      if (messageIds.length) {
        // Delete all related content items
        await db.content_items.where('messageId').anyOf(messageIds).delete();
        // Delete messages
        await db.messages.bulkDelete(messageIds);
      }

      // Finally, delete the conversation record itself
      await db.conversations.delete(conversationId);
    }
  );
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

// Hook to list conversation metas for a sidebar
export function useConversationList() {
  const list = useLiveQuery(
    async () => {
      return await db.conversations.orderBy('createdAt').reverse().toArray()
    },
  [],
  [] as ConversationRow[]
  )
  return list
}

// ---------- Files ----------

// Insert file meta+data; returns the new id
export function saveFile(messageId: string, file: File): string {
  const id = newId();

  async function saveFileDB(id: string, file: File, messageId: string) {
    // Read file data into an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const meta: FileMetaRow = {
      id,
      messageId,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      // Optional: width, height, duration extraction later
    };

    const data: FileDataRow = {
      id,
      data: arrayBuffer
    };

    // Store in IndexedDB
    await db.files_meta.add(meta);
    await db.files_data.add(data);
    console.log("File saved successfully")
  }

  // Fire and forget, but handle errors
  saveFileDB(id, file, messageId)
    .catch(err => console.error("Failed to save file:", err));

  return id;
}

// Load only file metadata (no data)
export async function loadFileMeta(fileId: string): Promise<FileMetaRow | null> {
  return (await db.files_meta.get(fileId)) ?? null;
}

// Load file data */
export async function loadFileData(fileId: string): Promise<ArrayBuffer | null> {
  console.log("Loading file:", fileId);
  const row = (await db.files_data.get(fileId)) ?? null;
  return row?.data;
}

// Load file as a real File object using meta + data
export async function loadFile(fileId: string): Promise<File | null> {
  const meta = await loadFileMeta(fileId);
  if (!meta) {
    console.warn("File meta not found for:", fileId);
    return null;
  }
  const data = await loadFileData(fileId);
  if (!data) {
    console.warn("File data not found for:", fileId);
    return null;
  }
  // Construct a proper File object (Blob + filename + type)
  return new File([data], meta.name, { type: meta.type });
}
// File Helper Functions
export function useFiles() {
  return {
    loadFileMeta: useCallback(loadFileMeta, []),
    loadFileData: useCallback(loadFileData, []),
    loadFile: useCallback(loadFile, []),
    saveFile: useCallback(saveFile, []),
  };
}

// Hook to load file metadata in React
export function useFileMeta(fileId : string) {
  const [file, setFile] = useState<FileMetaRow | null>(null);
  useEffect(() => {
    if (!fileId) {
      setFile(null);
      return;
    }
    let cancelled = false;
    async function checkUntilReady() {
      while (!cancelled) {
        const result = await loadFileMeta(fileId);
        if (result) {
          setFile(result);
          break; // stop polling once we find it
        }
        // Wait 200ms before trying again
        await new Promise(res => setTimeout(res, 200));
      }
    }
    checkUntilReady();
    return () => {
      cancelled = true;
    };
  }, [fileId]);
  return file;
}

// Hook to load actual file in React
export function useFile(fileId : string) {
  const [file, setFile] = useState<FileMetaRow | null>(null);
  const [data, setData] = useState<ArrayBuffer | null>(null);
  useEffect(() => {
    if (!fileId) {
      setFile(null);
      return;
    }
    let cancelled = false;
    async function checkMetaUntilReady() {
      while (!cancelled) {
        const meta = await loadFileMeta(fileId);
        if (meta) {
          setFile(meta);
          break; // stop polling once we find it
        }
        // Wait 200ms before trying again
        await new Promise(res => setTimeout(res, 200));
      }
    }
    async function checkDataUntilReady() {
      while (!cancelled) {
        const data = await loadFileData(fileId);
        if (data) {
          setData(data);
          break; // stop polling once we find it
        }
        // Wait 200ms before trying again
        await new Promise(res => setTimeout(res, 200));
      }
    }
    checkMetaUntilReady();
    checkDataUntilReady();
    return () => {
      cancelled = true;
    };
  }, [fileId]);
  return {file, data};
}

export function useFileBase64(fileId: string) {
  // Converts a file to base64 string format using FileReader
  const [base64, setBase64] = useState<string | null>(null);
  useEffect(() => {
    if (!fileId) {
      setBase64(null);
      return;
    }
    let cancelled = false;
    async function checkUntilReady() {
      while (!cancelled) {
        const file = await loadFile(fileId);
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (!cancelled) {
              setBase64(reader.result as string);
            }
          };
          reader.onerror = (err) => {
            console.error("FileReader error:", err);
            if (!cancelled) setBase64(null);
          };
          reader.readAsDataURL(file);
          break; // stop polling once we find it
        }
        // Wait 200ms before trying again
        await new Promise(res => setTimeout(res, 200));
      }
    }
    checkUntilReady();
    return () => {
      cancelled = true;
    };
  }, [fileId]);
  return base64;
}

// Converts a file to a decoded string using TextDecoder
export function useFileContent(fileId: string, encoding: string = "utf-8") {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setContent(null);
      return;
    }

    let cancelled = false;

    async function checkUntilReady() {
      while (!cancelled) {
        const file = await loadFile(fileId); // Your own function to retrieve a File object
        if (file) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const decoder = new TextDecoder(encoding);
            const text = decoder.decode(arrayBuffer);

            if (!cancelled) {
              setContent(text);
            }
          } catch (err) {
            console.error("Error decoding file:", err);
            if (!cancelled) setContent(null);
          }
          break; // stop polling once we have loaded/decoded
        }
        // Wait 200ms before trying again
        await new Promise((res) => setTimeout(res, 200));
      }
    }

    checkUntilReady();

    return () => {
      cancelled = true;
    };
  }, [fileId, encoding]);

  return content;
}