'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { Plus, RefreshCw, Trash2, FileText, Link, Youtube, HardDrive, AlignLeft, MoreHorizontal, AlertCircle } from 'lucide-react'
import { useSourceStore } from '../../stores/sourceStore'
import { useToastStore } from '../../stores/toastStore'
import { ws } from '../../lib/ws'
import { Source, SourceStatus } from '../../lib/ipc'
import { AddSourceModal } from './AddSourceModal'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

function statusColor(status: SourceStatus): string {
  switch (status) {
    case 'ready':    return 'var(--color-status-ready)'
    case 'indexing': return 'var(--color-status-indexing)'
    case 'uploading':return 'var(--color-status-indexing)'
    case 'error':    return 'var(--color-status-error)'
    default:         return 'var(--color-text-tertiary)'
  }
}

function SourceIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 flex-shrink-0"
  if (type === 'youtube') return <Youtube className={cls} />
  if (type === 'pdf' || type === 'file') return <FileText className={cls} />
  if (type === 'gdrive') return <HardDrive className={cls} />
  if (type === 'text') return <AlignLeft className={cls} />
  return <Link className={cls} />
}

function SourceRow({ source, notebookId }: { source: Source; notebookId: string }) {
  const { deleteSource, refreshSource } = useSourceStore()
  const { show: showToast } = useToastStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleDelete = async () => {
    setMenuOpen(false)
    try {
      await deleteSource(notebookId, source.id)
      showToast({ message: 'Source deleted', type: 'success' })
    } catch {
      showToast({ message: 'Failed to delete source', type: 'error' })
    }
  }

  const handleRefresh = async () => {
    setMenuOpen(false)
    try {
      await refreshSource(notebookId, source.id)
      showToast({ message: 'Refreshing source…', type: 'info' })
    } catch {
      showToast({ message: 'Failed to refresh source', type: 'error' })
    }
  }

  const canRefresh = source.type === 'url' || source.type === 'youtube' || source.type === 'gdrive'

  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
      style={{ background: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Status dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: statusColor(source.status) }}
        title={source.status}
      />

      {/* Icon */}
      <span style={{ color: 'var(--color-text-secondary)' }}>
        <SourceIcon type={source.type} />
      </span>

      {/* Title */}
      <span
        className="flex-1 truncate text-sm"
        style={{ color: 'var(--color-text-primary)' }}
        title={source.title}
      >
        {source.title}
      </span>

      {/* Error retry */}
      {source.status === 'error' && (
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--color-error)', background: 'rgba(255,69,58,0.10)' }}
        >
          <AlertCircle className="w-3 h-3" />
          Retry
        </button>
      )}

      {/* Context menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        <AP>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={spring}
              className="absolute right-0 top-7 z-50 min-w-[140px] rounded-xl py-1 overflow-hidden"
              style={{
                background: 'var(--color-elevated)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--color-separator)',
              }}
            >
              {canRefresh && (
                <button
                  onClick={handleRefresh}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                  style={{ color: 'var(--color-text-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              )}
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-error)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,69,58,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </motion.div>
          )}
        </AP>
      </div>
    </div>
  )
}

export function SourcesPanel({ notebookId }: { notebookId: string }) {
  const { sources, loading, error, fetchSources, updateSourceStatus } = useSourceStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const notebookSources = sources[notebookId] ?? []
  const isLoading = loading[notebookId] ?? false
  const loadError = error[notebookId] ?? null

  // Initial fetch
  useEffect(() => {
    fetchSources(notebookId)
  }, [notebookId])

  // Subscribe to source_status WS events
  useEffect(() => {
    const unsub = ws.on<{ notebook_id: string; source_id: string; status: SourceStatus }>(
      'source_status',
      (data) => {
        if (data.notebook_id === notebookId) {
          updateSourceStatus(notebookId, data.source_id, data.status)
        }
      }
    )
    return unsub
  }, [notebookId])

  const handleRefreshAll = async () => {
    setRefreshing(true)
    try { await fetchSources(notebookId, true) } finally { setRefreshing(false) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--color-separator)' }}
      >
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Sources
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {notebookSources.length} source{notebookSources.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="flex items-center justify-center w-8 h-8 rounded-xl transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Refresh sources"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
          >
            <Plus className="w-4 h-4" />
            Add source
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isLoading && notebookSources.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading…</span>
          </div>
        )}

        {loadError && (
          <div
            className="mx-2 my-3 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(255,69,58,0.08)', color: 'var(--color-error)' }}
          >
            {loadError}
          </div>
        )}

        {!isLoading && !loadError && notebookSources.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-6">
            <FileText className="w-10 h-10" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No sources yet. Add URLs, files, YouTube videos, or paste text.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
            >
              Add your first source
            </button>
          </div>
        )}

        {notebookSources.map((src) => (
          <SourceRow key={src.id} source={src} notebookId={notebookId} />
        ))}
      </div>

      {/* Add Source Modal */}
      <AP>
        {showAddModal && (
          <AddSourceModal
            notebookId={notebookId}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AP>
    </div>
  )
}
