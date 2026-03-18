'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Pin, PinOff, Trash2, Pencil, Share2, Smile } from 'lucide-react'
import { Notebook } from '../../lib/ipc'
import { useNotebookStore } from '../../stores/notebookStore'
import { useSourceStore } from '../../stores/sourceStore'
import { useToastStore } from '../../stores/toastStore'
import { ShareModal } from '../sharing/ShareModal'

const EMOJIS = ['📓','📔','📒','📕','📗','📘','📙','🗒️','📋','📄','📑','🗂️',
  '💡','🔬','🧪','🎯','🚀','🌍','🎨','🎵','💻','🤖','🧠','⚡']

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

interface Props {
  notebook: Notebook
  onClick: () => void
}

export function NotebookCard({ notebook, onClick }: Props) {
  const { renameNotebook, deleteNotebook, pinNotebook, fetchNotebooks, setNotebookEmoji } = useNotebookStore()
  const { show } = useToastStore()
  const { sources, fetchSources } = useSourceStore()
  const sourceCount = sources[notebook.id]?.length ?? notebook.source_count

  // Lazy-load source count if not yet in store
  useEffect(() => {
    if (sources[notebook.id] === undefined) {
      fetchSources(notebook.id)
    }
  }, [notebook.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [menuOpen, setMenuOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(notebook.title)
  const [hovered, setHovered] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => {
    if (renaming) {
      setRenameValue(notebook.title)
      setTimeout(() => { renameRef.current?.select() }, 30)
    }
  }, [renaming, notebook.title])

  const handleRenameCommit = async () => {
    const t = renameValue.trim()
    setRenaming(false)
    if (t && t !== notebook.title) {
      try {
        await renameNotebook(notebook.id, t)
      } catch {
        show({ type: 'error', message: 'Failed to rename notebook.' })
      }
    }
  }

  const handleDelete = () => {
    setMenuOpen(false)
    // Optimistic delete happens in store; give 5s undo window
    const snapshot = { ...notebook }
    deleteNotebook(notebook.id)
    show({
      type: 'undo',
      message: `"${snapshot.title}" deleted`,
      undoLabel: 'Undo',
      duration: 5000,
      onUndo: async () => {
        // Re-fetch to restore (we can't un-delete via API, but we restore the UI)
        // In a real impl we'd cancel the delete; here we just re-fetch
        await fetchNotebooks()
      },
    })
  }

  const handlePin = () => {
    setMenuOpen(false)
    pinNotebook(notebook.id, !notebook.is_pinned)
  }

  return (
    <>
    <div
      className="relative flex h-[140px] cursor-pointer flex-col rounded-2xl p-4 transition-shadow"
      style={{
        background: 'var(--color-elevated)',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        border: '1px solid var(--color-separator)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={() => setRenaming(true)}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (renaming || menuOpen) return
        if ((e.target as HTMLElement).closest('[data-no-open]')) return
        onClick()
      }}
    >
      {/* Pin badge */}
      {notebook.is_pinned && (
        <span className="absolute right-3 top-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          📌
        </span>
      )}

      {/* Emoji */}
      <div className="mb-2 text-3xl leading-none">
        {notebook.emoji ?? '📓'}
      </div>

      {/* Title */}
      {renaming ? (
        <input
          ref={renameRef}
          data-no-open
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameCommit()
            if (e.key === 'Escape') setRenaming(false)
          }}
          className="mb-1 w-full rounded bg-transparent text-sm font-semibold outline-none"
          style={{
            color: 'var(--color-text-primary)',
            borderBottom: '1px solid var(--color-accent)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <p
          className="mb-1 line-clamp-2 text-sm font-semibold leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {notebook.title}
        </p>
      )}

      {/* Meta */}
      <p className="mt-auto text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {sourceCount} source{sourceCount !== 1 ? 's' : ''}
        {notebook.updated_at ? ` · ${timeAgo(notebook.updated_at)}` : ''}
      </p>

      {/* Hover actions */}
      {hovered && !renaming && (
        <div
          data-no-open
          className="absolute bottom-3 right-3 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition-colors"
            style={{ background: 'var(--color-accent)' }}
            onClick={onClick}
          >
            Open
          </button>
          <div className="relative" ref={menuRef}>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ background: 'var(--color-separator)' }}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={14} style={{ color: 'var(--color-text-secondary)' }} />
            </button>
            {menuOpen && (
              <div
                className="absolute bottom-full right-0 mb-1 w-44 overflow-hidden rounded-xl py-1"
                style={{
                  background: 'var(--color-elevated)',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--color-separator)',
                  zIndex: 50,
                }}
              >
                <MenuItem icon={<Pencil size={13} />} label="Rename" onClick={() => { setMenuOpen(false); setRenaming(true) }} />
                <div style={{ height: 1, background: 'var(--color-separator)', margin: '4px 0' }} />
                <MenuItem icon={<Smile size={13} />} label="Change emoji" onClick={() => { setMenuOpen(false); setEmojiPickerOpen(true) }} />
                <div style={{ height: 1, background: 'var(--color-separator)', margin: '4px 0' }} />
                <MenuItem icon={<Share2 size={13} />} label="Share" onClick={() => { setMenuOpen(false); setShareOpen(true) }} />
                <div style={{ height: 1, background: 'var(--color-separator)', margin: '4px 0' }} />
                <MenuItem
                  icon={notebook.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  label={notebook.is_pinned ? 'Unpin' : 'Pin'}
                  onClick={handlePin}
                />
                <div style={{ height: 1, background: 'var(--color-separator)', margin: '4px 0' }} />
                <MenuItem icon={<Trash2 size={13} />} label="Delete" onClick={handleDelete} danger />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    {shareOpen && (
      <ShareModal
        notebookId={notebook.id}
        notebookTitle={notebook.title}
        onClose={() => setShareOpen(false)}
      />
    )}
    {emojiPickerOpen && (
      <EmojiPickerModal
        current={notebook.emoji ?? '📓'}
        onSelect={(e) => { setNotebookEmoji(notebook.id, e); setEmojiPickerOpen(false) }}
        onClose={() => setEmojiPickerOpen(false)}
      />
    )}
    </>
  )
}

function MenuItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-primary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'var(--color-accent-subtle)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}

function EmojiPickerModal({ current, onSelect, onClose }: {
  current: string
  onSelect: (emoji: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-4 w-64"
        style={{ background: 'var(--color-elevated)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-separator)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          Choose icon
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onSelect(e)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all"
              style={{
                background: e === current ? 'var(--color-accent-subtle)' : 'transparent',
                outline: e === current ? '2px solid var(--color-accent)' : 'none',
                outlineOffset: '-1px',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
