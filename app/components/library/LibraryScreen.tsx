'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Search, Mic, Video, FileText, Image, HelpCircle,
  CreditCard, BarChart2, GitBranch, Layers, AlertTriangle,
  FolderOpen, Trash2, Trash, RefreshCw, Download,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDownloadStore } from '../../stores/downloadStore'
import { useNotebookStore } from '../../stores/notebookStore'
import { useArtifactStore } from '../../stores/artifactStore'
import { useToastStore } from '../../stores/toastStore'
import { ArtifactType, DownloadRecord } from '../../lib/ipc'

// ── Type metadata ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  all:        { label: 'All',         icon: <Layers size={13} />,    color: 'var(--color-text-secondary)' },
  audio:      { label: 'Audio',       icon: <Mic size={13} />,       color: '#f59e0b' },
  video:      { label: 'Video',       icon: <Video size={13} />,     color: '#3b82f6' },
  slides:     { label: 'Slides',      icon: <Layers size={13} />,    color: '#8b5cf6' },
  infographic:{ label: 'Infographic', icon: <Image size={13} />,     color: '#10b981' },
  quiz:       { label: 'Quiz',        icon: <HelpCircle size={13} />,color: '#ef4444' },
  flashcards: { label: 'Flashcards',  icon: <CreditCard size={13} />,color: '#f97316' },
  report:     { label: 'Report',      icon: <FileText size={13} />,  color: '#6366f1' },
  data_table: { label: 'Data Table',  icon: <BarChart2 size={13} />, color: '#14b8a6' },
  mind_map:   { label: 'Mind Map',    icon: <GitBranch size={13} />, color: '#ec4899' },
}

const TYPE_FILTER_ORDER = ['all', 'audio', 'video', 'slides', 'infographic', 'quiz', 'flashcards', 'report', 'data_table', 'mind_map']

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number
  y: number
  record: DownloadRecord
}

function ContextMenu({
  state,
  onReveal,
  onDeleteRecord,
  onDeleteFile,
  onClose,
}: {
  state: ContextMenuState
  onReveal: () => void
  onDeleteRecord: () => void
  onDeleteFile: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-lg border overflow-hidden"
      style={{
        top: state.y,
        left: state.x,
        background: 'var(--color-elevated)',
        borderColor: 'var(--color-separator)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '180px',
      }}
    >
      {state.record.file_exists && (
        <ContextMenuItem
          icon={<FolderOpen size={13} />}
          label="Show in Finder"
          onClick={onReveal}
        />
      )}
      <ContextMenuItem
        icon={<Trash2 size={13} />}
        label="Delete record"
        onClick={onDeleteRecord}
      />
      {state.record.file_exists && (
        <ContextMenuItem
          icon={<Trash size={13} />}
          label="Delete file + record"
          onClick={onDeleteFile}
          danger
        />
      )}
    </div>
  )
}

function ContextMenuItem({
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
      className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-primary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'var(--color-app-bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Download card ─────────────────────────────────────────────────────────────

function DownloadCard({
  record,
  onContextMenu,
  onClick,
}: {
  record: DownloadRecord
  onContextMenu: (e: React.MouseEvent, record: DownloadRecord) => void
  onClick: (record: DownloadRecord) => void
}) {
  const meta = TYPE_META[record.artifact_type] ?? TYPE_META['report']

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      onClick={() => onClick(record)}
      onContextMenu={(e) => onContextMenu(e, record)}
      className="flex flex-col gap-2 rounded-xl border p-3 cursor-pointer transition-colors"
      style={{
        background: 'var(--color-content-bg)',
        borderColor: 'var(--color-separator)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-separator)')}
    >
      {/* Icon + type */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
          style={{
            background: `${meta.color}18`,
            color: meta.color,
          }}
        >
          {meta.icon}
          {meta.label}
        </div>
        {!record.file_exists && (
          <span title="File missing from disk">
            <AlertTriangle size={13} style={{ color: 'var(--color-warning)' }} />
          </span>
        )}
      </div>

      {/* Notebook title */}
      <p className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--color-text-primary)' }}>
        {record.notebook_title || 'Untitled Notebook'}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-tertiary)' }}
        >
          {record.format}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatBytes(record.file_size_bytes)}
        </span>
        <span className="text-[11px] ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatDate(record.downloaded_at)}
        </span>
      </div>
    </motion.div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function LibraryScreen() {
  const { downloads, loading, error, fetchDownloads, deleteDownload, revealDownload } = useDownloadStore()
  const { notebooks } = useNotebookStore()
  const { openCanvas } = useArtifactStore()
  const { show } = useToastStore()

  const [typeFilter, setTypeFilter] = useState('all')
  const [notebookFilter, setNotebookFilter] = useState('')
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchDownloads({})
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      fetchDownloads({
        artifactType: typeFilter !== 'all' ? typeFilter : undefined,
        notebookId: notebookFilter || undefined,
        search: search || undefined,
      })
    }, 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [typeFilter, notebookFilter, search])

  const handleContextMenu = useCallback((e: React.MouseEvent, record: DownloadRecord) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, record })
  }, [])

  const handleCardClick = useCallback((record: DownloadRecord) => {
    openCanvas(record.notebook_id, record.artifact_type as ArtifactType)
  }, [openCanvas])

  const handleReveal = async () => {
    if (!contextMenu) return
    const { record } = contextMenu
    setContextMenu(null)
    try {
      await revealDownload(record.id)
    } catch (e) {
      show({ type: 'error', message: `Could not reveal file: ${String(e)}` })
    }
  }

  const handleDeleteRecord = async () => {
    if (!contextMenu) return
    const { record } = contextMenu
    setContextMenu(null)
    try {
      await deleteDownload(record.id, false)
      show({ type: 'success', message: 'Record removed from library' })
    } catch (e) {
      show({ type: 'error', message: `Delete failed: ${String(e)}` })
    }
  }

  const handleDeleteFile = async () => {
    if (!contextMenu) return
    const { record } = contextMenu
    setContextMenu(null)
    try {
      await deleteDownload(record.id, true)
      show({ type: 'success', message: 'File and record deleted' })
    } catch (e) {
      show({ type: 'error', message: `Delete failed: ${String(e)}` })
    }
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--color-app-bg)' }}
      onClick={() => contextMenu && setContextMenu(null)}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--color-separator)', background: 'var(--color-content-bg)' }}
      >
        <div className="flex-1">
          <h1 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Downloads
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {downloads.length} {downloads.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <button
          onClick={() => fetchDownloads({ artifactType: typeFilter !== 'all' ? typeFilter : undefined, notebookId: notebookFilter || undefined, search: search || undefined })}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-col gap-2 px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--color-separator)', background: 'var(--color-content-bg)' }}
      >
        {/* Search + notebook filter */}
        <div className="flex items-center gap-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-1.5"
            style={{ borderColor: 'var(--color-separator)', background: 'var(--color-app-bg)' }}
          >
            <Search size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search downloads…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          <select
            value={notebookFilter}
            onChange={(e) => setNotebookFilter(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{
              borderColor: 'var(--color-separator)',
              background: 'var(--color-app-bg)',
              color: 'var(--color-text-primary)',
              maxWidth: '160px',
            }}
          >
            <option value="">All Notebooks</option>
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>{nb.emoji ? `${nb.emoji} ` : ''}{nb.title}</option>
            ))}
          </select>
        </div>

        {/* Type chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTER_ORDER.map((t) => {
            const meta = TYPE_META[t]
            const active = typeFilter === t
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  background: active ? 'var(--color-accent)' : 'var(--color-app-bg)',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-separator)'}`,
                }}
              >
                {meta.icon}
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-separator)', borderTopColor: 'var(--color-accent)' }} />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
            <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
          </div>
        )}

        {!loading && !error && downloads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Download size={32} style={{ color: 'var(--color-text-tertiary)', opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No downloads yet</p>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Generate artifacts in a notebook and download them — they'll appear here.
            </p>
          </div>
        )}

        {!loading && !error && downloads.length > 0 && (
          <motion.div
            layout
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            <AnimatePresence>
              {downloads.map((record) => (
                <DownloadCard
                  key={record.id}
                  record={record}
                  onContextMenu={handleContextMenu}
                  onClick={handleCardClick}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onReveal={handleReveal}
          onDeleteRecord={handleDeleteRecord}
          onDeleteFile={handleDeleteFile}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
