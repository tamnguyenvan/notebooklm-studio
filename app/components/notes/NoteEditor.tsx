'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useNotesStore } from '../../stores/notesStore'

interface Props {
  notebookId: string
  noteId: string
}

export function NoteEditor({ notebookId, noteId }: Props) {
  const { notes, updateNote } = useNotesStore()
  const note = (notes[notebookId] ?? []).find((n) => n.id === noteId)

  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [preview, setPreview] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef({ title: note?.title ?? '', content: note?.content ?? '' })

  // Sync local state when note changes (e.g. switching notes)
  useEffect(() => {
    if (!note) return
    setTitle(note.title)
    setContent(note.content)
    lastSavedRef.current = { title: note.title, content: note.content }
    setSaveStatus('saved')
  }, [noteId])

  const scheduleSave = useCallback(
    (newTitle: string, newContent: string) => {
      if (
        newTitle === lastSavedRef.current.title &&
        newContent === lastSavedRef.current.content
      ) return

      setSaveStatus('unsaved')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await updateNote(notebookId, noteId, newTitle, newContent)
          lastSavedRef.current = { title: newTitle, content: newContent }
          setSaveStatus('saved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 3000)
    },
    [notebookId, noteId, updateNote]
  )

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    scheduleSave(e.target.value, content)
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    scheduleSave(title, e.target.value)
  }

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        const t = title
        const c = content
        if (t !== lastSavedRef.current.title || c !== lastSavedRef.current.content) {
          updateNote(notebookId, noteId, t, c).catch(() => {})
        }
      }
    }
  }, [])

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Note not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Title + toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--color-separator)' }}
      >
        <input
          className="flex-1 bg-transparent text-sm font-semibold outline-none"
          style={{ color: 'var(--color-text-primary)' }}
          value={title}
          onChange={handleTitleChange}
          placeholder="Note title"
        />
        <span
          className="text-xs shrink-0"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {saveStatus === 'saved' ? 'Auto-saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}
        </span>
        <button
          onClick={() => setPreview((p) => !p)}
          className="p-1.5 rounded transition-colors shrink-0"
          style={{ color: preview ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = preview ? 'var(--color-accent)' : 'var(--color-text-tertiary)')
          }
          title={preview ? 'Edit' : 'Preview'}
        >
          {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-hidden flex">
        {/* Editor */}
        <textarea
          className="flex-1 bg-transparent text-sm outline-none resize-none p-4 font-mono leading-relaxed"
          style={{
            color: 'var(--color-text-primary)',
            display: preview ? 'none' : 'block',
          }}
          value={content}
          onChange={handleContentChange}
          placeholder="Start writing… (Markdown supported)"
        />

        {/* Preview */}
        {preview && (
          <div
            className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <ReactMarkdown>{content || '*Nothing to preview*'}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
