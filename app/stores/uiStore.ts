import { create } from 'zustand'
import { appStore } from './appStore'

export type View = 'notebooks' | 'library' | 'settings'

interface UIPrefs {
  view: View
  activeNotebookId: string | null
}

async function loadUIPrefs(): Promise<UIPrefs> {
  try {
    const saved = await appStore.get<UIPrefs>('ui_prefs')
    if (saved && typeof saved.view === 'string') return saved
  } catch {}
  return { view: 'notebooks', activeNotebookId: null }
}

async function saveUIPrefs(prefs: UIPrefs) {
  try { await appStore.set('ui_prefs', prefs) } catch {}
}

interface UIStore {
  view: View
  // Mirrors notebookStore.activeNotebookId for persistence purposes only
  // AppShell reads from notebookStore; this just saves/restores the last value
  lastActiveNotebookId: string | null
  prefsLoaded: boolean

  loadPrefs: () => Promise<void>
  setView: (view: View, notebookId?: string | null) => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  view: 'notebooks',
  lastActiveNotebookId: null,
  prefsLoaded: false,

  loadPrefs: async () => {
    const prefs = await loadUIPrefs()
    set({ view: prefs.view, lastActiveNotebookId: prefs.activeNotebookId, prefsLoaded: true })
  },

  setView: (view, notebookId = get().lastActiveNotebookId) => {
    const lastActiveNotebookId = view === 'notebooks' ? (notebookId ?? null) : null
    set({ view, lastActiveNotebookId })
    void saveUIPrefs({ view, activeNotebookId: lastActiveNotebookId })
  },
}))
