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

export type PersonaInfo = {
  title?: string
  description?: string
  category?: string
  path?: string
  courseId?: string
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
  // Pinned chats appear in their own sidebar area, independent of grouping.
  pinned?: boolean
  hasFirstPrompt?: boolean
  summary?: string
  summaryUpdatedAt?: number
  summarySourceHash?: string
  lastOpenedAt?: number
  // Ephemeral Meta chat row: hidden from the sidebar and normal summaries.
  isMetaChat?: boolean
  // Metadata for chats started from a persona, shown as a banner above the chat.
  persona?: PersonaInfo | null
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
  // Pinned topics appear in the sidebar's pinned area, independent of grouping.
  pinned?: boolean
  sortOrder?: number
}

// ---------- Workspaces ----------

export type SourceKind =
  | 'browser'
  | 'local'
  | 'mcp'
  | 'arcana'
  | 'arcana-filesystem'
  | 'agent'
  // A chat's own OPFS tree, linked into a workspace at /chats/<conversationId> while the chat is
  // attached (db/workspaceDb.ts#ensureChatStorageSource).
  | 'chat'
  // The caller's folder on the SAIA filesystem (saia/saia-rag-cli/saia-fs), auto-provisioned per
  // workspace while the deployment serves it (db/workspaceDb.ts#ensureSaiaFsSource).
  | 'saia-fs'
  // The caller's document collections on saia-rag, auto-provisioned per workspace while the
  // deployment serves it (db/workspaceDb.ts#ensureSaiaRagSource). It replaces the Arcana
  // filesystem drive in Storage.
  | 'saia-rag'

export type SourceStatus =
  | 'connected'
  | 'needs-permission'
  | 'offline'
  | 'disabled'
  | 'error'

export type WorkspaceCapabilities = {
  read: boolean
  write: boolean
  /** The provider can append to an existing file, or the shared helper can (read + write). */
  append?: boolean
  delete: boolean
  mkdir: boolean
  rename: boolean
  move: boolean
  copy: boolean
  serverSideMove: boolean
  serverSideCopy: boolean
  quota: boolean
  watch: boolean
  range: boolean
  maxFileSize?: number
}

export type BrowserConfig = { storage: 'opfs' | 'indexeddb' }
export type LocalConfig = {
  handleKey: string
  /** The picked folder's own name, so one folder can be recognised across workspaces. */
  folderName?: string
}
export type McpConfig = {
  endpoint: string
  transport: 'streamable-http' | 'sse'
  toolAllowlist: string[]
}
export type ArcanaConfig = { remoteWorkspaceId: string; baseUrl?: string }
export type AgentFilesConfig = { agentId: string }
export type ChatStorageConfig = { conversationId: string }
// The folder belongs to the caller's SAIA account, so the row carries no
// address of its own: the endpoint is the deployment's `/mcp/saia-fs` path.
export type SaiaFsConfig = Record<string, never>
// saia-rag collections also belong to the caller's account, so the row has no
// address: the endpoint is the deployment's `/mcp/saia-rag` path.
export type SaiaRagConfig = Record<string, never>

export type SourceConfig =
  | BrowserConfig
  | LocalConfig
  | McpConfig
  | ArcanaConfig
  | AgentFilesConfig
  | ChatStorageConfig
  | SaiaFsConfig
  | SaiaRagConfig

export type WorkspaceRow = {
  id: string
  name: string
  icon?: string
  color?: string
  // Pinned workspaces are listed in the sidebar's pinned section, next to
  // pinned chats, topics and agents. Unset means "not pinned"; no backfill or
  // schema bump is needed because the field is never indexed.
  pinned?: boolean
  createdAt: number
  lastModified: number
}

export type WorkspaceSourceRow = {
  id: string
  workspaceId: string
  kind: SourceKind
  label: string
  deviceId?: string
  config: SourceConfig
  capabilities: WorkspaceCapabilities
  readOnly?: boolean
  status: SourceStatus
  error?: string
  createdAt: number
  lastModified: number
}

export type WorkspaceHandleRow = {
  sourceId: string
  handle: FileSystemDirectoryHandle
}

export type TransferJobRow = {
  id: string
  workspaceId: string
  fromSourceId: string
  toSourceId: string
  fromPath: string
  toPath: string
  intent: 'copy' | 'move'
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  totalBytes?: number
  copiedBytes?: number
  error?: string
  createdAt: number
  updatedAt: number
}

export type WorkspaceFileEntry = {
  sourceId: string
  path: string
  name: string
  kind: 'file' | 'dir'
  size?: number
  mtime?: string
  mime?: string
  etag?: string
  childCount?: number
  /**
   * The entry cannot be written. A saia-rag collection carries the caller's role, so a
   * reader-only collection marks its row (and everything below it) read-only.
   */
  readOnly?: boolean
}

export type WorkspaceMountRow = {
  id: string
  workspaceId: string
  sourceId: string
  sourcePath: string
  path: string
  readOnly?: boolean
  createdAt: number
  lastModified: number
}

export type WorkspaceChatRow = {
  id: string
  workspaceId: string
  conversationId: string
  createdAt: number
}

export type WorkspaceAgentRow = {
  id: string
  workspaceId: string
  agentId: string
  createdAt: number
  // Set once the agent's currently active session was copied into this workspace.
  sessionsSeeded?: boolean
}

export type WorkspaceAgentSessionRow = {
  id: string
  workspaceId: string
  agentId: string
  sessionId: string
  createdAt: number
}

// Cached OpenCode session metadata (title, parentID, timestamps), so the sidebar and the
// agent page can still list sessions while the agent server is unreachable.
export type AgentSessionRow = {
  id: string
  agentId: string
  sessionId: string
  data: any
  updatedAt: number
  messagesSyncedAt?: number
  lastMessageId?: string | null
  messageCount?: number
  /** Set when the cached history was written into a restored session's instructions. */
  restoredFrom?: string | null
}

// One OpenCode message of an agent session. Messages are kept separate so a streaming
// message can be rewritten without cloning the whole history on every poll.
export type AgentSessionMessageRow = {
  id: string
  agentId: string
  sessionId: string
  messageId: string
  position: number
  data: any
  updatedAt: number
}

export type WorkspaceNodeRow = {
  id: string
  sourceId: string
  path: string
  parentPath: string
  name: string
  kind: 'file' | 'dir'
  size?: number
  mtime?: string
  mime?: string
}

export type WorkspaceBlobRow = {
  id: string
  sourceId: string
  data: Uint8Array
}

export type WorkspaceFileReferenceRow = {
  id: string
  conversationId: string
  workspaceId: string
  sourceId: string
  nodeId: string
  name?: string
  path?: string
  createdAt: number
}

/**
 * Encrypted-sync bookkeeping. `sync_records` stores the remote revision and
 * content hash a local record last agreed on, which is what turns "did this
 * change?" into a hash comparison instead of a timestamp guess.
 */
export type SyncRecordRow = {
  namespace: string
  id: string
  rev: number
  hash: string
}

export type SyncMetaRow = {
  key: string
  value: any
}
