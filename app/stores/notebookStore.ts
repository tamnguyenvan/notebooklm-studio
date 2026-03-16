import { create } from 'zustand'
import { ipc, Notebook } from '../lib/ipc'

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
  loading: boolean
  error: string | null

  fetchNotebooks: () => Promise<void>
  createNotebook: (title: string, emoji?: string) => Promise<Notebook>
  renameNotebook: (id: string, title: string) => Promise<void>
  deleteNotebook: (id: string) => Promise<void>
  pinNotebook: (id: string, pinned: boolean) => Promise<void>
  setActiveNotebook: (id: string | null) => void
  // Optimistic helpers
  _applyOptimistic: (notebooks: Notebook[]) => void
}

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  notebooks: [],
  activeNotebookId: null,
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

  setActiveNotebook: (id) => set({ activeNotebookId: id }),

  _applyOptimistic: (notebooks) => set({ notebooks }),
}))
