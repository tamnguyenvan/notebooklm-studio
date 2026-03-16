import { create } from 'zustand'
import { ipc, ResearchResult, ResearchState, Source } from '../lib/ipc'

export type ResearchMode = 'web' | 'drive'
export type ResearchDepth = 'fast' | 'deep'

interface ResearchStore {
  // keyed by notebookId
  results: Record<string, ResearchState>
  // which results are selected (by URL) per notebook
  selected: Record<string, Set<string>>
  // already-imported URLs per notebook (to show "Already imported" badge)
  imported: Record<string, Set<string>>
  // active task per notebook
  taskId: Record<string, string | null>
  searching: Record<string, boolean>
  error: Record<string, string | null>

  startSearch: (notebookId: string, query: string, mode: ResearchMode, depth: ResearchDepth) => Promise<string>
  loadResults: (notebookId: string) => Promise<void>
  toggleSelect: (notebookId: string, url: string) => void
  selectAll: (notebookId: string) => void
  clearSelection: (notebookId: string) => void
  importOne: (notebookId: string, result: ResearchResult) => Promise<Source>
  importSelected: (notebookId: string) => Promise<Source[]>
  importAll: (notebookId: string) => Promise<Source[]>
  markImported: (notebookId: string, urls: string[]) => void
  onTaskProgress: (taskId: string, notebookId: string, progress: number) => void
  onTaskComplete: (taskId: string, notebookId: string) => void
  onTaskError: (taskId: string, notebookId: string, error: string) => void
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  results: {},
  selected: {},
  imported: {},
  taskId: {},
  searching: {},
  error: {},

  startSearch: async (notebookId, query, mode, depth) => {
    set((s) => ({
      searching: { ...s.searching, [notebookId]: true },
      error: { ...s.error, [notebookId]: null },
    }))
    try {
      const { task_id } = await ipc.startResearch(notebookId, query, mode, depth)
      set((s) => ({ taskId: { ...s.taskId, [notebookId]: task_id } }))
      return task_id
    } catch (e) {
      set((s) => ({
        searching: { ...s.searching, [notebookId]: false },
        error: { ...s.error, [notebookId]: String(e) },
      }))
      throw e
    }
  },

  loadResults: async (notebookId) => {
    try {
      const state = await ipc.getResearchResults(notebookId)
      set((s) => ({
        results: { ...s.results, [notebookId]: state },
        searching: { ...s.searching, [notebookId]: false },
      }))
    } catch {
      // ignore — results may not exist yet
    }
  },

  toggleSelect: (notebookId, url) => {
    set((s) => {
      const prev = new Set(s.selected[notebookId] ?? [])
      if (prev.has(url)) prev.delete(url)
      else prev.add(url)
      return { selected: { ...s.selected, [notebookId]: prev } }
    })
  },

  selectAll: (notebookId) => {
    const sources = get().results[notebookId]?.sources ?? []
    const importedSet = get().imported[notebookId] ?? new Set()
    const urls = sources.filter((s) => !importedSet.has(s.url)).map((s) => s.url)
    set((s) => ({ selected: { ...s.selected, [notebookId]: new Set(urls) } }))
  },

  clearSelection: (notebookId) => {
    set((s) => ({ selected: { ...s.selected, [notebookId]: new Set() } }))
  },

  importOne: async (notebookId, result) => {
    const src = await ipc.importResearchResult(notebookId, result.url)
    get().markImported(notebookId, [result.url])
    return src
  },

  importSelected: async (notebookId) => {
    const selectedUrls = get().selected[notebookId] ?? new Set()
    const sources = get().results[notebookId]?.sources ?? []
    const toImport = sources
      .filter((s) => selectedUrls.has(s.url))
      .map((s) => ({ url: s.url, title: s.title }))
    if (toImport.length === 0) return []
    const { imported } = await ipc.importManyResearchResults(notebookId, toImport)
    get().markImported(notebookId, toImport.map((s) => s.url))
    get().clearSelection(notebookId)
    return imported
  },

  importAll: async (notebookId) => {
    const importedSet = get().imported[notebookId] ?? new Set()
    const sources = get().results[notebookId]?.sources ?? []
    const toImport = sources
      .filter((s) => !importedSet.has(s.url))
      .map((s) => ({ url: s.url, title: s.title }))
    if (toImport.length === 0) return []
    const { imported } = await ipc.importManyResearchResults(notebookId, toImport)
    get().markImported(notebookId, toImport.map((s) => s.url))
    get().clearSelection(notebookId)
    return imported
  },

  markImported: (notebookId, urls) => {
    set((s) => {
      const prev = new Set(s.imported[notebookId] ?? [])
      urls.forEach((u) => prev.add(u))
      return { imported: { ...s.imported, [notebookId]: prev } }
    })
  },

  onTaskProgress: (taskId, notebookId, progress) => {
    // progress is handled by the task bar; nothing extra needed here
  },

  onTaskComplete: async (taskId, notebookId) => {
    set((s) => ({ searching: { ...s.searching, [notebookId]: false } }))
    await get().loadResults(notebookId)
  },

  onTaskError: (taskId, notebookId, error) => {
    set((s) => ({
      searching: { ...s.searching, [notebookId]: false },
      error: { ...s.error, [notebookId]: error },
    }))
  },
}))
