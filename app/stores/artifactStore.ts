import { create } from 'zustand'
import { ipc, Artifact, ArtifactType, GenerateConfig } from '../lib/ipc'

const STALE_MS = 30_000

export interface ActiveTask {
  taskId: string
  notebookId: string
  artifactType: ArtifactType
  progress: number
  message: string
}

interface ArtifactStore {
  // artifacts keyed by notebookId
  artifacts: Record<string, Artifact[]>
  loading: Record<string, boolean>
  lastFetched: Record<string, number>
  // active generation tasks
  activeTasks: ActiveTask[]
  // canvas: which artifact is open
  canvasItem: { notebookId: string; artifactType: ArtifactType } | { notebookId: string; noteId: string; type: 'note' } | null

  fetchArtifacts: (notebookId: string, force?: boolean) => Promise<void>
  generate: (notebookId: string, config: GenerateConfig) => Promise<string>
  cancelTask: (taskId: string) => Promise<void>
  // WS event handlers
  onTaskProgress: (taskId: string, notebookId: string, progress: number, message: string) => void
  onTaskComplete: (taskId: string, notebookId: string, artifactType: ArtifactType) => void
  onTaskError: (taskId: string, notebookId: string, error: string) => void
  // Canvas
  openCanvas: (notebookId: string, artifactType: ArtifactType) => void
  openNote: (notebookId: string, noteId: string) => void
  closeCanvas: () => void
}

export const useArtifactStore = create<ArtifactStore>((set) => ({
  artifacts: {},
  loading: {},
  lastFetched: {},
  activeTasks: [],
  canvasItem: null,

  fetchArtifacts: async (notebookId, force = false) => {
    const s0 = useArtifactStore.getState()
    const last = s0.lastFetched[notebookId] ?? 0
    // Skip if fresh AND no active tasks for this notebook (generating tasks need live data)
    const hasActiveTasks = s0.activeTasks.some((t) => t.notebookId === notebookId)
    if (!force && !hasActiveTasks && Date.now() - last < STALE_MS && (s0.artifacts[notebookId]?.length ?? 0) > 0) return
    set((s) => ({ loading: { ...s.loading, [notebookId]: true } }))
    try {
      const artifacts = await ipc.listArtifacts(notebookId)
      set((s) => {
        const current = s.artifacts[notebookId] ?? []
        // Never downgrade a 'ready' artifact back to 'generating'
        const merged = artifacts.map((fresh) => {
          const existing = current.find((c) => c.type === fresh.type)
          if (existing?.status === 'ready' && fresh.status === 'generating') return existing
          return fresh
        })
        // Keep any locally-known types not yet returned by the API
        const freshTypes = new Set(merged.map((a) => a.type))
        const localOnly = current.filter((a) => !freshTypes.has(a.type))
        return {
          artifacts: { ...s.artifacts, [notebookId]: [...merged, ...localOnly] },
          loading: { ...s.loading, [notebookId]: false },
          lastFetched: { ...s.lastFetched, [notebookId]: Date.now() },
        }
      })
    } catch {
      set((s) => ({ loading: { ...s.loading, [notebookId]: false } }))
    }
  },

  generate: async (notebookId, config) => {
    const { task_id } = await ipc.generateArtifact(notebookId, config)
    const task: ActiveTask = {
      taskId: task_id,
      notebookId,
      artifactType: config.type as ArtifactType,
      progress: 0,
      message: 'Starting…',
    }
    // Mark artifact as generating
    set((s) => {
      const existing = s.artifacts[notebookId] ?? []
      const updated = existing.some((a) => a.type === config.type)
        ? existing.map((a) =>
            a.type === config.type
              ? { ...a, status: 'generating' as const, task_id, progress: 0 }
              : a
          )
        : [
            ...existing,
            {
              id: task_id,
              title: config.type,
              type: config.type as ArtifactType,
              status: 'generating' as const,
              task_id,
              progress: 0,
            },
          ]
      return {
        activeTasks: [...s.activeTasks, task],
        artifacts: { ...s.artifacts, [notebookId]: updated },
      }
    })
    return task_id
  },

  cancelTask: async (taskId) => {
    try {
      await ipc.cancelTask(taskId)
    } finally {
      set((s) => ({
        activeTasks: s.activeTasks.filter((t) => t.taskId !== taskId),
      }))
    }
  },

  onTaskProgress: (taskId, notebookId, progress, message) => {
    set((s) => ({
      activeTasks: s.activeTasks.map((t) =>
        t.taskId === taskId ? { ...t, progress, message } : t
      ),
      artifacts: {
        ...s.artifacts,
        [notebookId]: (s.artifacts[notebookId] ?? []).map((a) =>
          a.task_id === taskId ? { ...a, progress } : a
        ),
      },
    }))
  },

  onTaskComplete: (taskId, notebookId, artifactType) => {
    // Mark as ready immediately so the UI updates without waiting for fetch
    set((s) => ({
      activeTasks: s.activeTasks.filter((t) => t.taskId !== taskId),
      artifacts: {
        ...s.artifacts,
        [notebookId]: (s.artifacts[notebookId] ?? []).map((a) =>
          a.task_id === taskId || a.type === artifactType
            ? { ...a, status: 'ready' as const, progress: 100 }
            : a
        ),
      },
    }))
    // Refresh to get real artifact data, but merge carefully to not clobber ready state
    ipc.listArtifacts(notebookId).then((fresh) => {
      set((s) => {
        const current = s.artifacts[notebookId] ?? []
        // Merge: fresh list wins for ready artifacts, but keep any 'generating' ones
        // that aren't in the fresh list yet (still in-flight)
        const freshTypes = new Set(fresh.map((a) => a.type))
        const stillGenerating = current.filter(
          (a) => a.status === 'generating' && !freshTypes.has(a.type)
        )
        return {
          artifacts: {
            ...s.artifacts,
            [notebookId]: [...fresh, ...stillGenerating],
          },
        }
      })
    }).catch(() => {/* ignore — we already have the ready state */})
  },

  onTaskError: (taskId, notebookId, error) => {
    set((s) => ({
      activeTasks: s.activeTasks.filter((t) => t.taskId !== taskId),
      artifacts: {
        ...s.artifacts,
        [notebookId]: (s.artifacts[notebookId] ?? []).map((a) =>
          a.task_id === taskId
            ? { ...a, status: 'error' as const, error }
            : a
        ),
      },
    }))
  },

  openCanvas: (notebookId, artifactType) => {
    set({ canvasItem: { notebookId, artifactType } })
  },

  openNote: (notebookId, noteId) => {
    set({ canvasItem: { notebookId, noteId, type: 'note' } })
  },

  closeCanvas: () => set({ canvasItem: null }),
}))
