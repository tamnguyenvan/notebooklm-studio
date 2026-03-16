import { create } from 'zustand'
import { ipc, DownloadRecord, ArtifactType } from '../lib/ipc'

interface DownloadFilters {
  artifactType?: string
  notebookId?: string
  search?: string
}

interface DownloadStore {
  downloads: DownloadRecord[]
  loading: boolean
  error: string | null
  filters: DownloadFilters

  fetchDownloads: (filters?: DownloadFilters) => Promise<void>
  setFilters: (filters: DownloadFilters) => void
  deleteDownload: (id: string, deleteFile: boolean) => Promise<void>
  revealDownload: (id: string) => Promise<void>
  addDownload: (record: DownloadRecord) => void
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloads: [],
  loading: false,
  error: null,
  filters: {},

  fetchDownloads: async (filters) => {
    const f = filters ?? get().filters
    set({ loading: true, error: null, filters: f })
    try {
      const downloads = await ipc.listDownloads(f)
      set({ downloads, loading: false })
    } catch (e) {
      set({ loading: false, error: String(e) })
    }
  },

  setFilters: (filters) => {
    set({ filters })
    get().fetchDownloads(filters)
  },

  deleteDownload: async (id, deleteFile) => {
    // Optimistic removal
    const prev = get().downloads
    set((s) => ({ downloads: s.downloads.filter((d) => d.id !== id) }))
    try {
      await ipc.deleteDownload(id, deleteFile)
    } catch (e) {
      set({ downloads: prev })
      throw e
    }
  },

  revealDownload: async (id) => {
    await ipc.revealDownload(id)
  },

  addDownload: (record) => {
    set((s) => ({ downloads: [record, ...s.downloads] }))
  },
}))
