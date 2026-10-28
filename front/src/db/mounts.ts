import Dexie, { Table } from 'dexie'

// Local folders mounted into a conversation's agent workspace. Directory handles survive in
// IndexedDB, but the browser drops their permission on reload, so it is asked for again on use.
// A database of its own, so the conversation schema stays untouched.

export interface MountRecord {
  conversationId: string
  path: string
  handle: FileSystemDirectoryHandle
}

class MountsDB extends Dexie {
  mounts!: Table<MountRecord, [string, string]>

  constructor() {
    super('agent-mounts-db')
    this.version(1).stores({ mounts: '[conversationId+path], conversationId' })
  }
}

const mountsDb = new MountsDB()

export const saveMount = (record: MountRecord) => mountsDb.mounts.put(record)

export const getMounts = (conversationId: string) =>
  mountsDb.mounts.where('conversationId').equals(conversationId).toArray()

export const deleteMounts = (conversationId: string) =>
  mountsDb.mounts.where('conversationId').equals(conversationId).delete()

export const deleteAllMounts = () => mountsDb.mounts.clear()
