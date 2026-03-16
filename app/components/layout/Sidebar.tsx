'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Settings, LogOut, Plus, BookOpen, Library } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { useNotebookStore } from '../../stores/notebookStore'
import { NewNotebookModal } from '../notebooks/NewNotebookModal'

export function Sidebar({ onLibraryOpen }: { onLibraryOpen: () => void }) {
  const { account, logout } = useAuthStore()
  const { notebooks, activeNotebookId, setActiveNotebook, renameNotebook } = useNotebookStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

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

  const initials = account?.display_name
    ? account.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : account?.email
    ? account.email[0].toUpperCase()
    : '?'

  return (
    <div
      className="flex h-full w-[240px] shrink-0 flex-col"
      style={{
        background: 'var(--color-sidebar-bg)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderRight: '1px solid var(--color-separator)',
      }}
    >
      {/* Account row */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-separator)' }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: 'var(--color-accent)' }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {account?.display_name ?? account?.email ?? 'Account'}
          </p>
          {account?.display_name && (
            <p className="truncate text-xs leading-tight" style={{ color: 'var(--color-text-secondary)' }}>
              {account.email}
            </p>
          )}
        </div>
      </div>

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
          <AnimatePresence initial={false}>
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
                      className="flex items-center gap-2 rounded-md px-2 py-1.5"
                      style={{
                        background: 'var(--color-accent-subtle)',
                        borderLeft: '2px solid var(--color-accent)',
                      }}
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
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                      style={{
                        background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                        color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)',
                        borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span className="shrink-0 text-base leading-none">{nb.emoji ?? '📓'}</span>
                      <span className="flex-1 truncate text-sm">{nb.title}</span>
                      {nb.is_pinned && (
                        <span className="shrink-0 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>📌</span>
                      )}
                    </button>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>

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
        <SidebarLink icon={<BookOpen size={15} />} label="All Notebooks" onClick={() => { setActiveNotebook(null); }} />
        <SidebarLink icon={<Library size={15} />} label="Downloads" onClick={onLibraryOpen} />
        <SidebarLink icon={<Settings size={15} />} label="Settings" onClick={() => {}} />
        <SidebarLink icon={<LogOut size={15} />} label="Sign out" onClick={logout} danger />
      </div>

      <NewNotebookModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

function SidebarLink({
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
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-100"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'rgba(0,0,0,0.04)'
        e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-primary)'
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-secondary)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
