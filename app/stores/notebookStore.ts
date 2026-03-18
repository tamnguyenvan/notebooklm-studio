import { create } from 'zustand'
import { ipc, Notebook } from '../lib/ipc'
import { appStore } from './appStore'

const RECENTS_MAX = 5

async function loadPinOrder(): Promise<Record<string, number>> {
  try { return (await appStore.get<Record<string, number>>('pin_order')) ?? {} } catch { return {} }
}
async function savePinOrder(order: Record<string, number>) {
  try { await appStore.set('pin_order', order) } catch {}
}

// Recents: simple deque of max 5, persisted via tauri-plugin-store
async function loadRecents(): Promise<string[]> {
  try {
    const val = await appStore.get<string[]>('recents')
    return Array.isArray(val) ? val : []
  } catch { return [] }
}
async function saveRecents(ids: string[]) {
  try { await appStore.set('recents', ids) } catch {}
}

function pushRecent(id: string, current: string[]): string[] {
  // Remove existing entry, prepend, cap at RECENTS_MAX
  return [id, ...current.filter(r => r !== id)].slice(0, RECENTS_MAX)
}

function sortNotebooks(list: Notebook[], pinOrder: Record<string, number>): Notebook[] {
  return [...list].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    if (a.is_pinned && b.is_pinned) return (pinOrder[b.id] ?? 0) - (pinOrder[a.id] ?? 0)
    const ta = a.updated_at ?? a.created_at ?? ''
    const tb = b.updated_at ?? b.created_at ?? ''
    return tb.localeCompare(ta)
  })
}

interface NotebookStore {
  notebooks: Notebook[]
  activeNotebookId: string | null
  recentIds: string[]
  pinOrder: Record<string, number>
  loading: boolean
  error: string | null

  fetchNotebooks: () => Promise<void>
  createNotebook: (title: string, emoji?: string) => Promise<Notebook>
  renameNotebook: (id: string, title: string) => Promise<void>
  deleteNotebook: (id: string) => Promise<void>
  pinNotebook: (id: string, pinned: boolean) => Promise<void>
  setActiveNotebook: (id: string | null) => void
  removeRecent: (id: string) => void
  _applyOptimistic: (notebooks: Notebook[]) => void
}

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  notebooks: [],
  activeNotebookId: null,
  recentIds: loadRecents(),
  pinOrder: {},
  loading: false,
  error: null,

  fetchNotebooks: async () => {
    set({ loading: true, error: null })
    try {
      const [notebooks, pinOrder, recents] = await Promise.all([
        ipc.listNotebooks(),
        loadPinOrder(),
        loadRecents(),
      ])
      const merged = notebooks.map(n => ({ ...n, is_pinned: n.id in pinOrder }))
      set({ notebooks: sortNotebooks(merged, pinOrder), pinOrder, recentIds: recents, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  createNotebook: async (title, emoji) => {
    const nb = await ipc.createNotebook(title, emoji)
    set((s) => ({ notebooks: sortNotebooks([nb, ...s.notebooks], s.pinOrder) }))
    return nb
  },

  renameNotebook: async (id, title) => {
    set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, title } : n)) }))
    try {
      const updated = await ipc.renameNotebook(id, title)
      set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, ...updated } : n)) }))
    } catch (e) {
      get().fetchNotebooks(); throw e
    }
  },

  deleteNotebook: async (id) => {
    const prev = get().notebooks
    set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== id) }))
    try {
      await ipc.deleteNotebook(id)
      if (get().activeNotebookId === id) set({ activeNotebookId: null })
      const recents = get().recentIds.filter((r) => r !== id)
      void saveRecents(recents)
      const pinOrder = { ...get().pinOrder }
      delete pinOrder[id]
      await savePinOrder(pinOrder)
      set({ recentIds: recents, pinOrder })
    } catch (e) {
      set({ notebooks: prev }); throw e
    }
  },

  pinNotebook: async (id, pinned) => {
    const pinOrder = { ...get().pinOrder }
    if (pinned) pinOrder[id] = Date.now()
    else delete pinOrder[id]
    await savePinOrder(pinOrder)
    set((s) => ({
      pinOrder,
      notebooks: sortNotebooks(
        s.notebooks.map((n) => (n.id === id ? { ...n, is_pinned: pinned } : n)),
        pinOrder
      ),
    }))
    // Fire-and-forget to backend (best effort)
    ipc.pinNotebook(id, pinned).catch(() => {})
  },

  setActiveNotebook: (id) => {
    if (id) {
      // Push the newly opened notebook to the front of recents immediately
      const recents = pushRecent(id, get().recentIds)
      void saveRecents(recents)
      set({ activeNotebookId: id, recentIds: recents })
    } else {
      set({ activeNotebookId: null })
    }
  },

  removeRecent: (id) => {
    const recents = get().recentIds.filter((r) => r !== id)
    void saveRecents(recents)
    set({ recentIds: recents })
  },

  _applyOptimistic: (notebooks) => set({ notebooks }),
}))
