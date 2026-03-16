'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, StickyNote, Trash2 } from 'lucide-react'
import { useNotesStore } from '../../stores/notesStore'
import { useArtifactStore } from '../../stores/artifactStore'
import { useToastStore } from '../../stores/toastStore'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

interface Props {
  notebookId: string
}

export function NotesPanel({ notebookId }: Props) {
  const { notes, loading, fetchNotes, createNote, deleteNote, activeNoteId, setActiveNote } =
    useNotesStore()
  const { openNote, canvasItem, closeCanvas } = useArtifactStore()
  const { show } = useToastStore()

  const noteList = notes[notebookId] ?? []
  const isLoading = loading[notebookId] ?? false

  // Active note from canvas
  const openNoteId =
    canvasItem && 'type' in canvasItem && canvasItem.type === 'note' && canvasItem.notebookId === notebookId
      ? canvasItem.noteId
      : null

  useEffect(() => {
    fetchNotes(notebookId)
  }, [notebookId])

  const handleNewNote = async () => {
    try {
      const note = await createNote(notebookId)
      openNote(notebookId, note.id)
    } catch (e) {
      show({ type: 'error', message: `Failed to create note: ${String(e)}` })
    }
  }

  const handleOpenNote = (noteId: string) => {
    setActiveNote(notebookId, noteId)
    openNote(notebookId, noteId)
  }

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation()
    try {
      await deleteNote(notebookId, noteId)
      // If the deleted note was open in canvas, close it
      if (openNoteId === noteId) closeCanvas()
    } catch (err) {
      show({ type: 'error', message: `Failed to delete note: ${String(err)}` })
    }
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--color-separator)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Notes
        </span>
        <button
          onClick={handleNewNote}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <Plus className="w-3.5 h-3.5" />
          New Note
        </button>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
        {isLoading && noteList.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading…</p>
          </div>
        )}

        {!isLoading && noteList.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-accent-subtle)' }}
            >
              <StickyNote className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              No notes yet
            </p>
            <p className="text-xs max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Create a note to capture ideas, summaries, or anything from your research.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {noteList.map((note) => {
            const isActive = openNoteId === note.id
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring}
                onClick={() => handleOpenNote(note.id)}
                className="group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                style={{
                  background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : 'transparent'}`,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--color-app-bg)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <StickyNote
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                  >
                    {note.title || 'Untitled'}
                  </p>
                  {note.content && (
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {note.content.slice(0, 60)}
                    </p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formatDate(note.updated_at ?? note.created_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, note.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
