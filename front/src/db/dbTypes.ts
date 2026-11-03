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
  reasoning_effort: number
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
  folderId?: string | null
  hasFirstPrompt?: boolean
  summary?: string
  summaryUpdatedAt?: number
  summarySourceHash?: string
  lastOpenedAt?: number
  // Ephemeral Meta chat row: hidden from the sidebar and normal summaries.
  isMetaChat?: boolean
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
  feedback?: FeedbackRow
}

export type MessageInput = {
  id?: string
  idx: number
  role: MessageRole
  content: ContentItemInput[]
  createdAt?: number
  updatedAt?: number
  meta?: any
  feedback?: FeedbackRow
}

export type FeedbackRow = {
  rating?: number
  comment?: string
  result?: string
}

export type FormField = {
  name: string
  label?: string
  type: string            // html input type: text | number | range | checkbox | select | textarea | ...
  value?: any
  default?: any
  placeholder?: string
  min?: number
  max?: number
  step?: number
  options?: { value: string; label: string }[]
  required?: boolean
}

export type FormContent = {
  tool_id?: string
  title?: string
  description?: string
  fields: FormField[]
  submitted?: boolean     // true once the user has sent values
  values?: Record<string, any>  // captured input values after submit
}

export type ContentItemRow = {
  id: string
  messageId: string
  idx: number
  type: 'text' | 'file' | 'form'
  text?: string // for text, file ID for files
  fileId?: string
  form?: FormContent
  // what to do for meta?
}

export type ContentItemInput = {
  type: 'text' | 'file' | 'form'
  text?: string
  file?: File
  fileId?: string
  form?: FormContent
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

// Conversation grouping — surfaced in the UI as "Topics".
export type FolderRow = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  // One of TopicColorId (see components/Sidebar/topicColors.ts). Unset means
  // "derive from the id", so existing rows need no backfill.
  color?: string
  // One of TopicIconId (see components/Sidebar/topicIcons.ts). Unset falls back
  // to the default icon. Neither field is indexed, so no schema bump is needed.
  icon?: string
  sortOrder?: number
}

// ---------- Workspaces ----------

// A workspace points at a folder inside the browser-backed virtual file system.
// `rootPath` is always an absolute VFS path and is never the VFS root ("/").
export type WorkspaceRow = {
  id: string
  name: string
  rootPath: string
  mode: 'local'
  modelId: string
  modelName?: string
  skills: string[]
  settings: ConversationSettings
  createdAt: number
  lastModified: number
}

// One row per agent transcript message. `data` is a pi-agent `AgentMessage`
// (system | user | assistant | toolResult) kept verbatim so the runtime can be
// restored after a reload.
export type WorkspaceMessageRow = {
  id: string
  workspaceId: string
  idx: number
  data: any
  createdAt: number
}

// ---------- Virtual file system ----------

export type VfsNodeType = 'file' | 'folder'

// Files and folders share one tree. The VFS root ("/") is virtual and never has
// a row; every other absolute path does. Paths are unique.
export type VfsNodeRow = {
  id: string
  path: string
  parentPath: string
  name: string
  type: VfsNodeType
  size?: number
  mimeType?: string
  createdAt: number
  updatedAt: number
}

export type VfsBlobRow = {
  id: string
  blob: Blob
}
