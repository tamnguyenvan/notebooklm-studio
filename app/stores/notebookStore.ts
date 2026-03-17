import { create } from 'zustand'
import { ipc, Notebook } from '../lib/ipc'

const RECENTS_KEY = 'nb_recents'
const RECENTS_MAX = 8

function loadRecents(): string[] {
  if (typeof localStorage === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') } catch { return [] }
}

function saveRecents(ids: string[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(RECENTS_KEY, JSON.stringify(ids))
}

// Shared sort: pinned first, then newest first
function sortNotebooks(list: Notebook[]): Notebook[] {
  return [...list].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    const ta = a.updated_at ?? a.created_at ?? ''
    const tb = b.updated_at ?? b.created_at ?? ''
    return tb.localeCompare(ta)
  })
}

interface NotebookStore {
  notebooks: Notebook[]
  activeNotebookId: string | null
  recentIds: string[]
  loading: boolean
  error: string | null

  fetchNotebooks: () => Promise<void>
  createNotebook: (title: string, emoji?: string) => Promise<Notebook>
  renameNotebook: (id: string, title: string) => Promise<void>
  deleteNotebook: (id: string) => Promise<void>
  pinNotebook: (id: string, pinned: boolean) => Promise<void>
  setActiveNotebook: (id: string | null) => void
  removeRecent: (id: string) => void
  // Optimistic helpers
  _applyOptimistic: (notebooks: Notebook[]) => void
}

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  notebooks: [],
  activeNotebookId: null,
  recentIds: loadRecents(),
  loading: false,
  error: null,

  fetchNotebooks: async () => {
    set({ loading: true, error: null })
    try {
      const notebooks = await ipc.listNotebooks()
      set({ notebooks: sortNotebooks(notebooks), loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  createNotebook: async (title, emoji) => {
    const nb = await ipc.createNotebook(title, emoji)
    // Insert then re-sort so pinned notebooks stay on top
    set((s) => ({ notebooks: sortNotebooks([nb, ...s.notebooks]) }))
    return nb
  },

  renameNotebook: async (id, title) => {
    // Optimistic
    set((s) => ({
      notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, title } : n)),
    }))
    try {
      const updated = await ipc.renameNotebook(id, title)
      set((s) => ({
        notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, ...updated } : n)),
      }))
    } catch (e) {
      // Rollback by re-fetching
      get().fetchNotebooks()
      throw e
    }
  },

  deleteNotebook: async (id) => {
    // Optimistic removal
    const prev = get().notebooks
    set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== id) }))
    try {
      await ipc.deleteNotebook(id)
      if (get().activeNotebookId === id) set({ activeNotebookId: null })
      // Also remove from recents
      const recents = get().recentIds.filter((r) => r !== id)
      saveRecents(recents)
      set({ recentIds: recents })
    } catch (e) {
      set({ notebooks: prev })
      throw e
    }
  },

  pinNotebook: async (id, pinned) => {
    set((s) => ({
      notebooks: sortNotebooks(s.notebooks.map((n) => (n.id === id ? { ...n, is_pinned: pinned } : n))),
    }))
    try {
      await ipc.pinNotebook(id, pinned)
    } catch (e) {
      get().fetchNotebooks()
      throw e
    }
  },

  setActiveNotebook: (id) => {
    if (id) {
      // Push previous active to recents
      const prev = get().activeNotebookId
      if (prev && prev !== id) {
        const recents = [prev, ...get().recentIds.filter((r) => r !== prev && r !== id)].slice(0, RECENTS_MAX)
        saveRecents(recents)
        set({ recentIds: recents })
      }
    }
    set({ activeNotebookId: id })
  },

  removeRecent: (id) => {
    const recents = get().recentIds.filter((r) => r !== id)
    saveRecents(recents)
    set({ recentIds: recents })
  },

  _applyOptimistic: (notebooks) => set({ notebooks }),
}))
