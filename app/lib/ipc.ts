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
}
