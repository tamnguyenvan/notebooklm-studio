'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, BookOpen, Library, Pencil, Pin, PinOff, Trash2, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { useNotebookStore } from '../../stores/notebookStore'
import { useToastStore } from '../../stores/toastStore'
import { useSourceStore } from '../../stores/sourceStore'
import { NewNotebookModal } from '../notebooks/NewNotebookModal'
import { ShareModal } from '../sharing/ShareModal'
import { Notebook } from '../../lib/ipc'

const MENU_W = 176
const MENU_H = 200

export function Sidebar({
  onLibraryOpen,
  onAllNotebooks,
  open,
}: {
  onLibraryOpen: () => void
  onAllNotebooks: () => void
  open: boolean
}) {
  const { notebooks, activeNotebookId, setActiveNotebook, renameNotebook, deleteNotebook, pinNotebook, fetchNotebooks } = useNotebookStore()
  const { show } = useToastStore()
  const { sources } = useSourceStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [shareNotebook, setShareNotebook] = useState<Notebook | null>(null)

  // Context menu state: { id, x, y }
  const [ctxMenu, setCtxMenu] = useState<{ nb: Notebook; x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  useEffect(() => {
    if (renamingId) setTimeout(() => renameInputRef.current?.select(), 30)
  }, [renamingId])

  const startRename = (id: string, currentTitle: string) => {
    setRenameValue(currentTitle)
    setRenamingId(id)
  }

  const commitRename = async () => {
    if (!renamingId) return
    const t = renameValue.trim()
    const id = renamingId
    setRenamingId(null)
    if (t) {
      try { await renameNotebook(id, t) } catch { /* store handles rollback */ }
    }
  }

  const handleCtxRename = (nb: Notebook) => {
    setCtxMenu(null)
    setRenameValue(nb.title)
    setRenamingId(nb.id)
  }

  const handleCtxPin = (nb: Notebook) => {
    setCtxMenu(null)
    pinNotebook(nb.id, !nb.is_pinned)
  }

  const handleCtxShare = (nb: Notebook) => {
    setCtxMenu(null)
    setShareNotebook(nb)
  }

  const handleCtxDelete = (nb: Notebook) => {
    setCtxMenu(null)
    deleteNotebook(nb.id)
    show({
      type: 'undo',
      message: `"${nb.title}" deleted`,
      undoLabel: 'Undo',
      duration: 5000,
      onUndo: async () => { await fetchNotebooks() },
    })
  }

  return (
    <>
    <AP initial={false}>
      {open && (
        <motion.div
          key="sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 240, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className="flex h-full shrink-0 flex-col overflow-hidden"
          style={{
            background: 'var(--color-sidebar-bg)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            borderRight: '1px solid var(--color-separator)',
          }}
        >
      {/* Notebooks section */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Notebooks
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="flex h-5 w-5 items-center justify-center rounded transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="New notebook"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-separator)'
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--color-text-tertiary)'
            }}
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <AP initial={false}>
            {notebooks.map((nb) => {
              const isActive = nb.id === activeNotebookId
              const isRenaming = renamingId === nb.id

              return (
                <motion.div
                  key={nb.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                >
                  {isRenaming ? (
                    <div
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 mx-0.5"
                      style={{ background: 'var(--color-accent-subtle)' }}
                    >
                      <span className="shrink-0 text-base leading-none">{nb.emoji ?? '📓'}</span>
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="flex-1 bg-transparent text-sm font-medium outline-none"
                        style={{
                          color: 'var(--color-text-primary)',
                          borderBottom: '1px solid var(--color-accent)',
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveNotebook(nb.id)}
                      onDoubleClick={() => startRename(nb.id, nb.title)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setCtxMenu({ nb, x: e.clientX, y: e.clientY })
                      }}
                      title={nb.title}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 mx-0.5 text-left transition-colors"
                      style={{
                        background: isActive
                          ? 'var(--color-sidebar-active, rgba(0,0,0,0.09))'
                          : 'transparent',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--color-sidebar-hover, rgba(0,0,0,0.05))'
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span className="shrink-0 text-base leading-none">{nb.emoji ?? '📓'}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate text-sm font-medium leading-tight"
                          style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-primary)' }}
                        >
                          {nb.title}
                        </p>
                        <p
                          className="text-[11px] mt-0.5 leading-tight"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          {(() => {
                            const liveCount = sources[nb.id]?.length
                            const count = liveCount ?? nb.source_count
                            return count > 0
                              ? `${count} source${count !== 1 ? 's' : ''}`
                              : 'No sources'
                          })()}
                          {nb.is_pinned && ' · Pinned'}
                        </p>
                      </div>
                    </button>
                  )}
                </motion.div>
              )
            })}
          </AP>

          {notebooks.length === 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs transition-colors"
              style={{
                border: '1px dashed var(--color-separator)',
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)'
                e.currentTarget.style.color = 'var(--color-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-separator)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
            >
              <Plus size={12} />
              New Notebook
            </button>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div
        className="flex flex-col gap-1 p-2"
        style={{ borderTop: '1px solid var(--color-separator)' }}
      >
        <SidebarLink icon={<BookOpen size={15} />} label="All Notebooks" onClick={onAllNotebooks} />
        <SidebarLink icon={<Library size={15} />} label="Downloads" onClick={onLibraryOpen} />
        {/* Primary: New Notebook */}
        <button
          onClick={() => setModalOpen(true)}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          style={{ background: 'var(--color-accent)' }}
        >
          <Plus size={14} />
          New Notebook
        </button>
      </div>

      <NewNotebookModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </motion.div>
      )}
    </AP>

    {/* Context menu — portalled to body to escape overflow:hidden */}
    {ctxMenu && typeof document !== 'undefined' && createPortal(
      <div
        ref={ctxRef}
        className="fixed z-[9999] overflow-hidden rounded-xl py-1.5"
        style={{
          top: Math.min(ctxMenu.y, window.innerHeight - MENU_H - 8),
          left: Math.min(ctxMenu.x, window.innerWidth - MENU_W - 8),
          width: MENU_W,
          background: 'var(--color-elevated)',
          border: '1px solid var(--color-separator)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <CtxItem icon={<Pencil size={13} />} label="Rename" onClick={() => handleCtxRename(ctxMenu.nb)} />
        <div className="my-1 h-px" style={{ background: 'var(--color-separator)' }} />
        <CtxItem icon={<Share2 size={13} />} label="Share" onClick={() => handleCtxShare(ctxMenu.nb)} />
        <div className="my-1 h-px" style={{ background: 'var(--color-separator)' }} />
        <CtxItem
          icon={ctxMenu.nb.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
          label={ctxMenu.nb.is_pinned ? 'Unpin' : 'Pin'}
          onClick={() => handleCtxPin(ctxMenu.nb)}
        />
        <div className="my-1 h-px" style={{ background: 'var(--color-separator)' }} />
        <CtxItem icon={<Trash2 size={13} />} label="Delete" onClick={() => handleCtxDelete(ctxMenu.nb)} danger />
      </div>,
      document.body
    )}

    {/* Share modal — also portalled */}
    {shareNotebook && typeof document !== 'undefined' && createPortal(
      <ShareModal
        notebookId={shareNotebook.id}
        notebookTitle={shareNotebook.title}
        onClose={() => setShareNotebook(null)}
      />,
      document.body
    )}
    </>
  )
}

function SidebarLink({
  icon, label, onClick, danger, active,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-100"
      style={{
        background: active ? 'var(--color-accent-subtle)' : 'transparent',
        color: danger ? 'var(--color-error)' : active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (!active) e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'rgba(0,0,0,0.04)'
        if (!active) e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-primary)'
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (!active) e.currentTarget.style.background = 'transparent'
        if (!active) e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-secondary)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function CtxItem({
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
      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-primary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'rgba(0,0,0,0.04)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span className="flex w-4 items-center justify-center shrink-0">{icon}</span>
      {label}
    </button>
  )
}
