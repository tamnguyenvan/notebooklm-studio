import { create } from 'zustand'
import { ipc, Account } from '../lib/ipc'

interface AuthStore {
  isLoggedIn: boolean
  account: Account | null
  loginInProgress: boolean
  error: string | null

  checkStatus: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>
  setError: (msg: string | null) => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isLoggedIn: false,
  account: null,
  loginInProgress: false,
  error: null,

  checkStatus: async () => {
    try {
      const status = await ipc.getAuthStatus()
      set({
        isLoggedIn: status.is_logged_in,
        account: status.account ?? null,
        error: null,
      })
    } catch {
      set({ isLoggedIn: false, account: null })
    }
  },

  login: async () => {
    set({ loginInProgress: true, error: null })
    try {
      const result = await ipc.login()
      set({
        isLoggedIn: true,
        account: result.account,
        loginInProgress: false,
        error: null,
      })
    } catch (e: unknown) {
      const msg = parseError(e)
      set({ loginInProgress: false, error: msg })
    }
  },

  logout: async () => {
    try {
      await ipc.logout()
    } catch {
      // best-effort
    }
    set({ isLoggedIn: false, account: null, error: null })
  },

  setError: (msg) => set({ error: msg }),
}))

function parseError(e: unknown): string {
  if (typeof e === 'string') {
    try {
      const parsed = JSON.parse(e)
      return parsed?.detail?.message ?? parsed?.message ?? e
    } catch {
      return e
    }
  }
  if (e instanceof Error) return e.message
  return 'An unexpected error occurred.'
}
