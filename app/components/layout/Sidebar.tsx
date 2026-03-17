'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, BookOpen, Library, Pencil, Pin, PinOff, Trash2, Share2, Search, X, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { useNotebookStore } from '../../stores/notebookStore'
import { useToastStore } from '../../stores/toastStore'
import { useSourceStore } from '../../stores/sourceStore'
import { NewNotebookModal } from '../notebooks/NewNotebookModal'
import { ShareModal } from '../sharing/ShareModal'
import { Notebook } from '../../lib/ipc'

const PIN_ICON = (
  <svg width="10" height="10" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline', flexShrink: 0 }}>
    <path style={{ fill: 'var(--color-text-tertiary)' }} d="m240.294 308.285-36.58-36.58a8.62 8.62 0 0 0-12.194 0L20.811 442.413a8.6 8.6 0 0 0-2.083 3.37L.437 500.654c-2.201 6.602 4.288 13.114 10.906 10.907l54.871-18.291a8.64 8.64 0 0 0 3.37-2.083l170.709-170.709a8.62 8.62 0 0 0 .001-12.193"/>
    <path style={{ fill: '#e35336' }} d="M468.888 158.879 353.119 43.111a8.624 8.624 0 0 0-12.193 0L176.314 207.722a8.62 8.62 0 0 0 0 12.194l115.769 115.769a8.62 8.62 0 0 0 12.194 0l164.612-164.612a8.624 8.624 0 0 0-.001-12.194"/>
    <path style={{ fill: '#d93c1c' }} d="M336.291 317.017c-10.295-32.976-28.732-63.403-53.319-87.99s-55.012-43.024-87.99-53.319c-31.906-9.962-66.249-12.372-99.316-6.979-6.794 1.109-9.585 9.729-4.708 14.607L328.662 421.04c4.88 4.878 13.499 2.078 14.606-4.709 5.397-33.065 2.983-67.407-6.977-99.314m163.082-188.622L383.603 12.627C375.461 4.485 364.635 0 353.119 0c-11.515 0-22.341 4.485-30.484 12.627-8.142 8.143-12.627 18.968-12.627 30.484s4.485 22.341 12.627 30.484l115.769 115.769c8.143 8.143 18.969 12.627 30.485 12.627s22.341-4.485 30.483-12.627S512 170.395 512 158.88s-4.485-22.341-12.627-30.485"/>
  </svg>
)

const MENU_W = 176
const MENU_H = 200
const RECENTS_MIN_H = 72
const RECENTS_MAX_H = 300
const RECENTS_DEFAULT_H = 200

export function Sidebar({
  onLibraryOpen,
  onAllNotebooks,
  open,
}: {
  onLibraryOpen: () => void
  onAllNotebooks: () => void
  open: boolean
}) {
  const { notebooks, activeNotebookId, recentIds, setActiveNotebook, renameNotebook, deleteNotebook, pinNotebook, fetchNotebooks, removeRecent } = useNotebookStore()
  const { show } = useToastStore()
  const { sources } = useSourceStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [shareNotebook, setShareNotebook] = useState<Notebook | null>(null)
  const [search, setSearch] = useState('')
  const [recentsOpen, setRecentsOpen] = useState(true)
  const [recentsHeight, setRecentsHeight] = useState(RECENTS_DEFAULT_H)

  const onResizeDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = recentsHeight
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(RECENTS_MIN_H, Math.min(RECENTS_MAX_H, startH + ev.clientY - startY))
      setRecentsHeight(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [recentsHeight])

  // Context menu state
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

  const handleCtxRename = (nb: Notebook) => { setCtxMenu(null); setRenameValue(nb.title); setRenamingId(nb.id) }
  const handleCtxPin = (nb: Notebook) => { setCtxMenu(null); pinNotebook(nb.id, !nb.is_pinned) }
  const handleCtxShare = (nb: Notebook) => { setCtxMenu(null); setShareNotebook(nb) }
  const handleCtxDelete = (nb: Notebook) => {
    setCtxMenu(null)
    deleteNotebook(nb.id)
    show({ type: 'undo', message: `"${nb.title}" deleted`, undoLabel: 'Undo', duration: 5000, onUndo: async () => { await fetchNotebooks() } })
  }

  // Recents: resolve notebook objects in order, skip active
  const recentNotebooks = (Array.isArray(recentIds) ? recentIds : [])
    .map((id) => notebooks.find((n) => n.id === id))
    .filter((n): n is Notebook => !!n)
    .slice(0, 5)

  // Filtered notebook list
  const filteredNotebooks = search.trim()
    ? notebooks.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : notebooks

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
          {/* ── Recents section ── always rendered to preserve height */}
          <div className="flex flex-col shrink-0">
              <button
                onClick={() => setRecentsOpen((v) => !v)}
                className="flex items-center gap-1.5 px-4 pb-1 pt-3 w-full"
              >
                <Clock size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
                  Recents
                </span>
                <motion.span
                  animate={{ rotate: recentsOpen ? 0 : -90 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  style={{ display: 'flex', color: 'var(--color-text-tertiary)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.span>
              </button>

              {recentsOpen && (
                <div>
                  <div className="overflow-y-auto px-2" style={{ height: recentsHeight }}>
                    {recentNotebooks.length === 0 ? (
                      <p className="px-2.5 py-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No recent notebooks</p>
                    ) : recentNotebooks.map((nb) => (
                      <RecentRow
                        key={nb.id}
                        nb={nb}
                        sourceCount={sources[nb.id]?.length ?? nb.source_count}
                        isActive={nb.id === activeNotebookId}
                        onOpen={() => setActiveNotebook(nb.id)}
                        onRemove={() => removeRecent(nb.id)}
                        onContextMenu={(x, y) => setCtxMenu({ nb, x, y })}
                      />
                    ))}
                  </div>
                  {/* Drag handle */}
                  <div
                    onMouseDown={onResizeDrag}
                    className="flex items-center justify-center h-3 cursor-ns-resize select-none"
                  >
                    <div className="w-8 h-0.5 rounded-full" style={{ background: 'var(--color-separator)' }} />
                  </div>
                </div>
              )}

              <div className="mx-4 mb-1 h-px" style={{ background: 'var(--color-separator)' }} />
            </div>

          {/* ── Notebooks section ── */}
          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
                Notebooks
              </span>
              <button
                onClick={() => setModalOpen(true)}
                className="flex h-5 w-5 items-center justify-center rounded transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
                title="New notebook"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-separator)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)' }}>
                <Search size={11} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notebooks…"
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: 'var(--color-text-primary)' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
              <AP initial={false}>
                {filteredNotebooks.map((nb) => {
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
                        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 mx-0.5" style={{ background: 'var(--color-accent-subtle)' }}>
                          <span className="shrink-0 text-base leading-none">{nb.emoji ?? '📓'}</span>
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                            className="flex-1 bg-transparent text-sm font-medium outline-none"
                            style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-accent)' }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveNotebook(nb.id)}
                          onDoubleClick={() => startRename(nb.id, nb.title)}
                          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ nb, x: e.clientX, y: e.clientY }) }}
                          title={nb.title}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 mx-0.5 text-left transition-colors"
                          style={{ background: isActive ? 'var(--color-sidebar-active, rgba(0,0,0,0.09))' : 'transparent' }}
                          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!isActive) e.currentTarget.style.background = 'var(--color-sidebar-hover, rgba(0,0,0,0.05))' }}
                          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                        >
                          <span className="shrink-0 text-base leading-none">{nb.emoji ?? '📓'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium leading-tight" style={{ color: 'var(--color-text-primary)' }}>{nb.title}</p>
                            <p className="text-[11px] mt-0.5 leading-tight flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                              {(() => {
                                const count = sources[nb.id]?.length ?? nb.source_count
                                return count > 0 ? `${count} source${count !== 1 ? 's' : ''}` : 'No sources'
                              })()}
                              {nb.is_pinned && <span className="text-[10px]"> · 📌</span>}
                            </p>
                          </div>
                        </button>
                      )}
                    </motion.div>
                  )
                })}
              </AP>

              {filteredNotebooks.length === 0 && search && (
                <p className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  No notebooks match "{search}"
                </p>
              )}

              {notebooks.length === 0 && !search && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-xs transition-colors"
                  style={{ border: '1px dashed var(--color-separator)', color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-separator)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                >
                  <Plus size={12} />
                  New Notebook
                </button>
              )}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex flex-col gap-1 p-2" style={{ borderTop: '1px solid var(--color-separator)' }}>
            <SidebarLink icon={<BookOpen size={15} />} label="All Notebooks" onClick={onAllNotebooks} />
            <SidebarLink icon={<Library size={15} />} label="Downloads" onClick={onLibraryOpen} />
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

    {/* Context menu — portalled */}
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

    {/* Share modal — portalled */}
    {shareNotebook && typeof document !== 'undefined' && createPortal(
      <ShareModal notebookId={shareNotebook.id} notebookTitle={shareNotebook.title} onClose={() => setShareNotebook(null)} />,
      document.body
    )}
    </>
  )
}

// ── Recent row ────────────────────────────────────────────────────────────────

function RecentRow({ nb, sourceCount, isActive, onOpen, onRemove, onContextMenu }: {
  nb: Notebook
  sourceCount: number
  isActive: boolean
  onOpen: () => void
  onRemove: () => void
  onContextMenu: (x: number, y: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 mx-0.5 cursor-pointer transition-colors"
      style={{ background: isActive ? 'var(--color-sidebar-active)' : hovered ? 'var(--color-sidebar-hover)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      title={nb.title}
    >
      <span className="shrink-0 text-base leading-none">{nb.emoji ?? '📓'}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium leading-tight" style={{ color: 'var(--color-text-primary)' }}>{nb.title}</p>
        <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--color-text-tertiary)' }}>
          {sourceCount > 0 ? `${sourceCount} source${sourceCount !== 1 ? 's' : ''}` : 'No sources'}
        </p>
      </div>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 flex items-center justify-center w-4 h-4 rounded transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-separator)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent' }}
          title="Remove from recents"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SidebarLink({ icon, label, onClick, danger, active }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-100"
      style={{ background: active ? 'var(--color-accent-subtle)' : 'transparent', color: danger ? 'var(--color-error)' : active ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontWeight: active ? 600 : 400 }}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!active) { e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-primary)' } }}
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-secondary)' } }}
    >
      {icon}
      {label}
    </button>
  )
}

function CtxItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
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
