// ---------- Types ----------

export type MessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool' | 'function' | 'info'

export type ModelSpec = {
  id: string
  name: string
  input: string[]
  output: string[]
  // More fields can be added
  [k: string]: any
}

export type ConversationSettings = {
  model: ModelSpec | string
  temperature: number
  top_p: number
  memory: number
  enable_tools: boolean
  enable_web_search: boolean
  tools: Record<string, any>
  arcana: Record<string, any>
  [k: string]: any
}

export type ConversationRow = {
  id: string // uuid
  title: string
  createdAt: number
  lastModified: number
  settings: ConversationSettings
  messageCount: number
}

export type HydratedConversation = ConversationRow & {
  messages: any[]
}

export type MessageRow = {
  id: string
  conversationId: string
  idx: number
  role: MessageRole
  createdAt: number
  updatedAt?: number
  meta?: any // e.g. model
}

export type MessageInput = {
  id?: string
  idx: number
  role: MessageRole
  content: ContentItemInput[]
  createdAt?: number
  updatedAt?: number
  meta?: any
}

export type ContentItemRow = {
  id: string
  messageId: string
  idx: number
  type: 'text' | 'file'
  text?: string // for text, file ID for files
  fileId?: string
  // what to do for meta?
}

export type ContentItemInput = {
  type: 'text' | 'file'
  text?: string
  file?: File
  fileId?: string
}

// Table: file_data
export type FileDataRow = {
  id: string // shared with FileMetaRow
  data: ArrayBuffer
}

export type FileMetaRow = {
  id: string // shared with FileDataRow
  conversationId: string
  name: string
  type: string
  size: number
  width?: number
  height?: number
  duration?: number
  extra?: any
}


export type HydratedMessage = {
  id: string
  conversationId: string
  idx: number
  role: MessageRole
  createdAt: number
  updatedAt?: number
  meta?: any // e.g. model
  content: ContentItemRow[]
}
