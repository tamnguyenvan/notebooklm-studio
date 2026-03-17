import { create } from 'zustand'
import { ipc, Note } from '../lib/ipc'

const STALE_MS = 30_000

interface NotesStore {
  // notes keyed by notebookId
  notes: Record<string, Note[]>
  loading: Record<string, boolean>
  lastFetched: Record<string, number>
  // which note is open in canvas per notebook
  activeNoteId: Record<string, string | null>

  fetchNotes: (notebookId: string, force?: boolean) => Promise<void>
  createNote: (notebookId: string, title?: string, content?: string) => Promise<Note>
  updateNote: (notebookId: string, noteId: string, title: string, content: string) => Promise<void>
  deleteNote: (notebookId: string, noteId: string) => Promise<void>
  setActiveNote: (notebookId: string, noteId: string | null) => void
  // Called from ChatPanel "Save to Notes" — creates a note pre-filled with content
  prefillNote: (notebookId: string, content: string, title?: string) => Promise<Note>
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: {},
  loading: {},
  lastFetched: {},
  activeNoteId: {},

  fetchNotes: async (notebookId, force = false) => {
    const last = get().lastFetched[notebookId] ?? 0
    if (!force && Date.now() - last < STALE_MS && (get().notes[notebookId]?.length ?? 0) > 0) return
    set((s) => ({ loading: { ...s.loading, [notebookId]: true } }))
    try {
      const notes = await ipc.listNotes(notebookId)
      set((s) => ({
        notes: { ...s.notes, [notebookId]: notes },
        loading: { ...s.loading, [notebookId]: false },
        lastFetched: { ...s.lastFetched, [notebookId]: Date.now() },
      }))
    } catch {
      set((s) => ({ loading: { ...s.loading, [notebookId]: false } }))
    }
  },

  createNote: async (notebookId, title = 'New Note', content = '') => {
    const note = await ipc.createNote(notebookId, title, content)
    set((s) => ({
      notes: { ...s.notes, [notebookId]: [note, ...(s.notes[notebookId] ?? [])] },
      activeNoteId: { ...s.activeNoteId, [notebookId]: note.id },
    }))
    return note
  },

  updateNote: async (notebookId, noteId, title, content) => {
    const updated = await ipc.updateNote(notebookId, noteId, title, content)
    set((s) => ({
      notes: {
        ...s.notes,
        [notebookId]: (s.notes[notebookId] ?? []).map((n) =>
          n.id === noteId ? updated : n
        ),
      },
    }))
  },

  deleteNote: async (notebookId, noteId) => {
    await ipc.deleteNote(notebookId, noteId)
    set((s) => {
      const remaining = (s.notes[notebookId] ?? []).filter((n) => n.id !== noteId)
      const activeId = s.activeNoteId[notebookId]
      return {
        notes: { ...s.notes, [notebookId]: remaining },
        activeNoteId: {
          ...s.activeNoteId,
          [notebookId]: activeId === noteId ? (remaining[0]?.id ?? null) : activeId,
        },
      }
    })
  },

  setActiveNote: (notebookId, noteId) => {
    set((s) => ({ activeNoteId: { ...s.activeNoteId, [notebookId]: noteId } }))
  },

  prefillNote: async (notebookId, content, title = 'Note from Chat') => {
    const note = await ipc.createNote(notebookId, title, content)
    set((s) => ({
      notes: { ...s.notes, [notebookId]: [note, ...(s.notes[notebookId] ?? [])] },
      activeNoteId: { ...s.activeNoteId, [notebookId]: note.id },
    }))
    return note
  },
}))
