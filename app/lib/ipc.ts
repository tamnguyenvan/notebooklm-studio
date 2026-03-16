/**
 * IPC client — all invoke() calls go through here.
 * Only exports functions for routes that exist in the sidecar.
 * Module 1: Auth only.
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

export const ipc = {
  // ── Module 1: Auth ──────────────────────────────────────────────────────
  getAuthStatus: () => invoke<AuthStatus>('get_auth_status'),
  login:         () => invoke<{ status: string; account: Account }>('login'),
  logout:        () => invoke<{ status: string }>('logout'),
}
