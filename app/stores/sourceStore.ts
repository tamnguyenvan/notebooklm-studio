import { create } from 'zustand'
import { ipc, Source, SourceStatus } from '../lib/ipc'

const STALE_MS = 30_000

interface SourceStore {
  // sources keyed by notebookId
  sources: Record<string, Source[]>
  loading: Record<string, boolean>
  error: Record<string, string | null>
  lastFetched: Record<string, number>

  fetchSources: (notebookId: string, force?: boolean) => Promise<void>
  addSource: (source: Source) => void
  updateSourceStatus: (notebookId: string, sourceId: string, status: SourceStatus) => void
  deleteSource: (notebookId: string, sourceId: string) => Promise<void>
  refreshSource: (notebookId: string, sourceId: string) => Promise<void>
}

export const useSourceStore = create<SourceStore>((set, get) => ({
  sources: {},
  loading: {},
  error: {},
  lastFetched: {},

  fetchSources: async (notebookId, force = false) => {
    const last = get().lastFetched[notebookId] ?? 0
    if (!force && Date.now() - last < STALE_MS && (get().sources[notebookId]?.length ?? 0) > 0) return
    set((s) => ({ loading: { ...s.loading, [notebookId]: true }, error: { ...s.error, [notebookId]: null } }))
    try {
      const sources = await ipc.listSources(notebookId)
      set((s) => {
        // Merge: keep optimistic entries not yet returned by API, update existing ones
        const incoming = new Map(sources.map((src) => [src.id, src]))
        const optimistic = (s.sources[notebookId] ?? []).filter((src) => !incoming.has(src.id))
        return {
          sources: { ...s.sources, [notebookId]: [...sources, ...optimistic] },
          loading: { ...s.loading, [notebookId]: false },
          lastFetched: { ...s.lastFetched, [notebookId]: Date.now() },
        }
      })
    } catch (e) {
      set((s) => ({
        loading: { ...s.loading, [notebookId]: false },
        error: { ...s.error, [notebookId]: String(e) },
      }))
    }
  },

  addSource: (source) => {
    set((s) => {
      const existing = s.sources[source.notebook_id] ?? []
      // Skip if already in store (by id or url)
      if (existing.some((src) => src.id === source.id || (source.url && src.url === source.url))) {
        return s
      }
      return {
        sources: {
          ...s.sources,
          [source.notebook_id]: [source, ...existing],
        },
      }
    })
  },

  updateSourceStatus: (notebookId, sourceId, status) => {
    set((s) => ({
      sources: {
        ...s.sources,
        [notebookId]: (s.sources[notebookId] ?? []).map((src) =>
          src.id === sourceId ? { ...src, status } : src
        ),
      },
    }))
  },

  deleteSource: async (notebookId, sourceId) => {
    // Optimistic
    const prev = get().sources[notebookId] ?? []
    set((s) => ({
      sources: {
        ...s.sources,
        [notebookId]: (s.sources[notebookId] ?? []).filter((src) => src.id !== sourceId),
      },
    }))
    try {
      await ipc.deleteSource(notebookId, sourceId)
    } catch (e) {
      set((s) => ({ sources: { ...s.sources, [notebookId]: prev } }))
      throw e
    }
  },

  refreshSource: async (notebookId, sourceId) => {
    get().updateSourceStatus(notebookId, sourceId, 'indexing')
    try {
      await ipc.refreshSource(notebookId, sourceId)
    } catch (e) {
      get().updateSourceStatus(notebookId, sourceId, 'error')
      throw e
    }
  },
}))
