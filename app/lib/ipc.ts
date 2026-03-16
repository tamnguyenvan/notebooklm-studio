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
}
