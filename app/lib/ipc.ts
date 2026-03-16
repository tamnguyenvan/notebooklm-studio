/**
 * IPC client — all invoke() calls go through here.
 * Only exports functions for routes that exist in the sidecar.
 */
import { invoke } from '@tauri-apps/api/core'

export interface Account {
  email: string
  display_name?: string | null
  avatar_url?: string | null
}

export interface AuthStatus {
  is_logged_in: boolean
  account?: Account | null
}

export interface Notebook {
  id: string
  title: string
  emoji?: string | null
  created_at: string | null
  updated_at: string | null
  source_count: number
  is_pinned: boolean
}

export type SourceType = 'url' | 'youtube' | 'pdf' | 'text' | 'gdrive' | string
export type SourceStatus = 'uploading' | 'indexing' | 'ready' | 'error'

export interface Source {
  id: string
  notebook_id: string
  type: SourceType
  title: string
  url?: string | null
  filename?: string | null
  status: SourceStatus
  created_at: string | null
}

export interface ChatReference {
  source_id: string
  citation_number: number | null
  cited_text: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  references: ChatReference[]
  suggested_followups: string[]
  pending?: boolean
  error?: string
}

// ── Studio types ─────────────────────────────────────────────────────────────

export type ArtifactType =
  | 'audio' | 'video' | 'slides' | 'infographic'
  | 'quiz' | 'flashcards' | 'report' | 'data_table' | 'mind_map'

export type ArtifactStatus = 'none' | 'generating' | 'ready' | 'error'

export interface Artifact {
  id: string
  title: string
  type: ArtifactType
  status: ArtifactStatus
  task_id?: string
  progress?: number
  created_at?: string | null
  url?: string | null
  error?: string
}

export type GenerateConfig =
  | { type: 'audio'; format: 'deep_dive' | 'brief' | 'critique' | 'debate'; length: 'short' | 'medium' | 'long'; language: string; instructions?: string }
  | { type: 'video'; format: 'standard' | 'shorts'; style: string }
  | { type: 'slides'; format: 'detailed' | 'presenter'; length: 'short' | 'medium' | 'long'; instructions?: string }
  | { type: 'quiz'; quantity: 'few' | 'standard' | 'many'; difficulty: 'easy' | 'medium' | 'hard' | 'mixed' }
  | { type: 'flashcards'; quantity: 'few' | 'standard' | 'many'; difficulty: 'easy' | 'medium' | 'hard' | 'mixed' }
  | { type: 'infographic'; orientation: 'portrait' | 'landscape' | 'square'; detail: 'overview' | 'standard' | 'detailed' }
  | { type: 'report'; template: 'briefing' | 'study_guide' | 'blog_post' | 'custom'; extra_instructions?: string }
  | { type: 'data_table'; structure_prompt: string }
  | { type: 'mind_map' }

// ── Download / Library types ──────────────────────────────────────────────────

export interface DownloadRecord {
  id: string
  notebook_id: string
  notebook_title: string
  artifact_type: ArtifactType
  format: string
  local_path: string
  file_size_bytes: number
  downloaded_at: string
  file_exists: boolean
}

// ── Research types ────────────────────────────────────────────────────────────

export interface ResearchResult {
  url: string
  title: string
  domain: string
  snippet: string
}

export interface ResearchState {
  task_id: string | null
  status: 'no_research' | 'completed'
  query: string
  sources: ResearchResult[]
  summary: string
}

// ── Notes types ───────────────────────────────────────────────────────────────

export interface Note {
  id: string
  title: string
  content: string
  created_at: string | null
  updated_at: string | null
}

// ── Sharing types ─────────────────────────────────────────────────────────────

export type SharePermission = 'viewer' | 'editor' | 'owner'

export interface SharedUser {
  email: string
  permission: SharePermission
}

export interface ShareStatus {
  is_public: boolean
  share_url: string | null
  shared_users: SharedUser[]
}

export const ipc = {
  // ── Module 1: Auth ──────────────────────────────────────────────────────
  getAuthStatus: () => invoke<AuthStatus>('get_auth_status'),
  login:         () => invoke<{ status: string; account: Account }>('login'),
  logout:        () => invoke<{ status: string }>('logout'),

  // ── Module 2: Notebooks ─────────────────────────────────────────────────
  listNotebooks:  () => invoke<Notebook[]>('list_notebooks'),
  createNotebook: (title: string, emoji?: string) =>
    invoke<Notebook>('create_notebook', { title, emoji }),
  renameNotebook: (id: string, title: string) =>
    invoke<Notebook>('rename_notebook', { id, title }),
  deleteNotebook: (id: string) =>
    invoke<{ status: string }>('delete_notebook', { id }),
  pinNotebook:    (id: string, pinned: boolean) =>
    invoke<{ status: string; pinned: boolean }>('pin_notebook', { id, pinned }),

  // ── Module 3: Sources ───────────────────────────────────────────────────
  listSources: (notebookId: string) =>
    invoke<Source[]>('list_sources', { notebookId }),
  addSourceUrl: (notebookId: string, url: string) =>
    invoke<Source>('add_source_url', { notebookId, url }),
  addSourceYoutube: (notebookId: string, url: string) =>
    invoke<Source>('add_source_youtube', { notebookId, url }),
  addSourceFile: (notebookId: string, filePath: string) =>
    invoke<Source>('add_source_file', { notebookId, filePath }),
  addSourceText: (notebookId: string, title: string, text: string) =>
    invoke<Source>('add_source_text', { notebookId, title, text }),
  addSourceGdrive: (notebookId: string, driveUrl: string) =>
    invoke<Source>('add_source_gdrive', { notebookId, driveUrl }),
  refreshSource: (notebookId: string, sourceId: string) =>
    invoke<{ status: string }>('refresh_source', { notebookId, sourceId }),
  deleteSource: (notebookId: string, sourceId: string) =>
    invoke<{ status: string }>('delete_source', { notebookId, sourceId }),
  getSourceFulltext: (notebookId: string, sourceId: string) =>
    invoke<{ content: string; char_count: number }>('get_source_fulltext', { notebookId, sourceId }),

  // ── Utilities ───────────────────────────────────────────────────────────
  openFileDialog: () =>
    invoke<string | null>('open_file_dialog'),

  // ── Module 4: Chat ──────────────────────────────────────────────────────
  sendMessage: (notebookId: string, message: string, conversationId?: string) =>
    invoke<{ answer: string; conversation_id: string; turn_number: number; references: ChatReference[]; suggested_followups: string[] }>(
      'send_message', { notebookId, message, conversationId }
    ),
  getChatHistory: (notebookId: string) =>
    invoke<ChatMessage[]>('get_chat_history', { notebookId }),
  setPersona: (notebookId: string, instructions: string) =>
    invoke<{ status: string }>('set_persona', { notebookId, instructions }),

  // ── Module 5: Studio ────────────────────────────────────────────────────
  listArtifacts: (notebookId: string) =>
    invoke<Artifact[]>('list_artifacts', { notebookId }),
  generateArtifact: (notebookId: string, config: GenerateConfig) =>
    invoke<{ task_id: string }>('generate_artifact', { notebookId, config }),
  cancelTask: (taskId: string) =>
    invoke<{ status: string }>('cancel_task', { taskId }),
  getArtifactData: (notebookId: string, artifactType: ArtifactType) =>
    invoke<unknown>('get_artifact_data', { notebookId, artifactType }),
  getArtifactStreamUrl: (notebookId: string, artifactType: ArtifactType) =>
    invoke<string>('get_artifact_stream_url', { notebookId, artifactType }),
  downloadArtifact: (notebookId: string, artifactType: ArtifactType, destPath: string, format?: string) =>
    invoke<string>('download_artifact', { notebookId, artifactType, destPath, format }),
  openSaveDialog: (filename: string, filters: { name: string; extensions: string[] }[]) =>
    invoke<string | null>('open_save_dialog', { filename, filters }),

  // ── Module 6: Downloads / Library ───────────────────────────────────────
  listDownloads: (filters?: { artifactType?: string; notebookId?: string; search?: string }) =>
    invoke<DownloadRecord[]>('list_downloads', {
      artifactType: filters?.artifactType ?? null,
      notebookId:   filters?.notebookId   ?? null,
      search:       filters?.search       ?? null,
    }),
  recordDownload: (
    notebookId: string,
    notebookTitle: string,
    artifactType: string,
    format: string,
    localPath: string,
  ) => invoke<DownloadRecord>('record_download', { notebookId, notebookTitle, artifactType, format, localPath }),
  deleteDownload: (downloadId: string, deleteFile: boolean) =>
    invoke<{ status: string }>('delete_download', { downloadId, deleteFile }),
  revealDownload: (downloadId: string) =>
    invoke<{ status: string }>('reveal_download', { downloadId }),

  // ── Module 7: Research ──────────────────────────────────────────────────
  startResearch: (notebookId: string, query: string, mode: 'web' | 'drive', depth: 'fast' | 'deep') =>
    invoke<{ task_id: string }>('start_research', { notebookId, query, mode, depth }),
  getResearchResults: (notebookId: string) =>
    invoke<ResearchState>('get_research_results', { notebookId }),
  importResearchResult: (notebookId: string, resultUrl: string) =>
    invoke<Source>('import_research_result', { notebookId, resultUrl }),
  importManyResearchResults: (notebookId: string, sources: { url: string; title: string }[]) =>
    invoke<{ imported: Source[] }>('import_many_research_results', { notebookId, sources }),

  // ── Module 8: Notes ─────────────────────────────────────────────────────
  listNotes: (notebookId: string) =>
    invoke<Note[]>('list_notes', { notebookId }),
  createNote: (notebookId: string, title: string, content: string) =>
    invoke<Note>('create_note', { notebookId, title, content }),
  updateNote: (notebookId: string, noteId: string, title: string, content: string) =>
    invoke<Note>('update_note', { notebookId, noteId, title, content }),
  deleteNote: (notebookId: string, noteId: string) =>
    invoke<{ status: string }>('delete_note', { notebookId, noteId }),

  // ── Module 9: Sharing ───────────────────────────────────────────────────
  getSharingStatus: (notebookId: string) =>
    invoke<ShareStatus>('get_sharing_status', { notebookId }),
  setSharingPublic: (notebookId: string, public_: boolean) =>
    invoke<ShareStatus>('set_sharing_public', { notebookId, public: public_ }),
  addSharingUser: (notebookId: string, email: string, permission: SharePermission, notify: boolean, welcomeMessage: string) =>
    invoke<ShareStatus>('add_sharing_user', { notebookId, email, permission, notify, welcomeMessage }),
  removeSharingUser: (notebookId: string, email: string) =>
    invoke<ShareStatus>('remove_sharing_user', { notebookId, email }),
}
