'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import {
  Mic, Video, Presentation, HelpCircle, CreditCard,
  Image, FileText, Table, GitBranch,
  AlertCircle, Loader2, Download, X, Play, MoreHorizontal,
  Pencil, Trash2, Share2, Check,
} from 'lucide-react'
import { useArtifactStore } from '../../stores/artifactStore'
import { useToastStore } from '../../stores/toastStore'
import { useNotebookStore } from '../../stores/notebookStore'
import { useDownloadStore } from '../../stores/downloadStore'
import { useSourceStore } from '../../stores/sourceStore'
import { ws } from '../../lib/ws'
import { ArtifactType, Artifact, GenerateConfig } from '../../lib/ipc'
import { ipc } from '../../lib/ipc'
import { GenerateModal } from './GenerateModal'
import { ShareModal } from '../sharing/ShareModal'

const GENERATING_TIMEOUT_MS = 20 * 60 * 1000

interface Props {
  notebookId: string
}

interface ArtifactMeta {
  type: ArtifactType
  label: string
  icon: React.ReactNode
}

const ARTIFACT_TYPES: ArtifactMeta[] = [
  { type: 'audio',       label: 'Audio',       icon: <Mic size={14} /> },
  { type: 'video',       label: 'Video',        icon: <Video size={14} /> },
  { type: 'slides',      label: 'Slides',       icon: <Presentation size={14} /> },
  { type: 'quiz',        label: 'Quiz',         icon: <HelpCircle size={14} /> },
  { type: 'flashcards',  label: 'Flashcards',   icon: <CreditCard size={14} /> },
  { type: 'infographic', label: 'Infographic',  icon: <Image size={14} /> },
  { type: 'report',      label: 'Report',       icon: <FileText size={14} /> },
  { type: 'data_table',  label: 'Data Table',   icon: <Table size={14} /> },
  { type: 'mind_map',    label: 'Mind Map',     icon: <GitBranch size={14} /> },
]

const DOWNLOAD_FORMATS: Record<ArtifactType, { label: string; ext: string; format: string }> = {
  audio:       { label: 'MP4',      ext: 'mp4',  format: 'mp4' },
  video:       { label: 'MP4',      ext: 'mp4',  format: 'mp4' },
  slides:      { label: 'PDF',      ext: 'pdf',  format: 'pdf' },
  infographic: { label: 'PNG',      ext: 'png',  format: 'png' },
  quiz:        { label: 'JSON',     ext: 'json', format: 'json' },
  flashcards:  { label: 'JSON',     ext: 'json', format: 'json' },
  report:      { label: 'Markdown', ext: 'md',   format: 'markdown' },
  data_table:  { label: 'CSV',      ext: 'csv',  format: 'csv' },
  mind_map:    { label: 'JSON',     ext: 'json', format: 'json' },
}

const DIVIDER_MIN = 120
const DIVIDER_MAX_RATIO = 0.75

export function StudioPanel({ notebookId }: Props) {
  const { artifacts, loading, activeTasks, fetchArtifacts, generate, cancelTask,
    onTaskProgress, onTaskComplete, onTaskError, openCanvas,
    renameArtifact, deleteArtifact } = useArtifactStore()
  const { show } = useToastStore()
  const { notebooks } = useNotebookStore()
  const { addDownload } = useDownloadStore()
  const { sources: allSources } = useSourceStore()
  const notebookSources = (allSources[notebookId] ?? []).filter((s) => s.status === 'ready')
  const [modalType, setModalType] = useState<ArtifactType | null>(null)
  const [taskStartTimes] = useState<Map<string, number>>(new Map())
  const [shareOpen, setShareOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Artifact | null>(null)

  // Vertical split
  const containerRef = useRef<HTMLDivElement>(null)
  const [topHeight, setTopHeight] = useState(260)

  const onDividerDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = topHeight
    const onMove = (ev: MouseEvent) => {
      const containerH = containerRef.current?.clientHeight ?? 600
      const next = Math.max(DIVIDER_MIN, Math.min(containerH * DIVIDER_MAX_RATIO, startH + ev.clientY - startY))
      setTopHeight(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [topHeight])

  const notebookArtifacts = artifacts[notebookId] ?? []

  useEffect(() => { fetchArtifacts(notebookId) }, [notebookId])

  // Timeout watchdog
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      activeTasks.forEach((task) => {
        if (task.notebookId !== notebookId) return
        const started = taskStartTimes.get(task.taskId)
        if (!started) { taskStartTimes.set(task.taskId, now); return }
        if (now - started > GENERATING_TIMEOUT_MS) {
          onTaskError(task.taskId, notebookId, 'Generation timed out')
          show({ type: 'error', message: `${task.artifactType.replace('_', ' ')} generation timed out` })
        }
      })
    }, 10_000)
    return () => clearInterval(interval)
  }, [activeTasks, notebookId])

  useEffect(() => {
    const unsubs = [
      ws.on<{ task_id: string; notebook_id: string; progress: number; message: string }>(
        'task_progress',
        (e) => { if (e.notebook_id === notebookId) onTaskProgress(e.task_id, e.notebook_id, e.progress, e.message) }
      ),
      ws.on<{ task_id: string; notebook_id: string; artifact_type: string }>(
        'task_complete',
        (e) => {
          if (e.notebook_id === notebookId) {
            onTaskComplete(e.task_id, e.notebook_id, e.artifact_type as ArtifactType)
            show({ type: 'success', message: `${e.artifact_type.replace('_', ' ')} is ready` })
          }
        }
      ),
      ws.on<{ task_id: string; notebook_id: string; error: string }>(
        'task_error',
        (e) => {
          if (e.notebook_id === notebookId) {
            onTaskError(e.task_id, e.notebook_id, e.error)
            show({ type: 'error', message: `Generation failed: ${e.error}` })
          }
        }
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [notebookId])

  const handleGenerate = async (config: GenerateConfig) => {
    setModalType(null)
    try {
      const taskId = await generate(notebookId, config)
      taskStartTimes.set(taskId, Date.now())
    } catch (e) {
      show({ type: 'error', message: `Failed to start generation: ${String(e)}` })
    }
  }

  const handleCancel = async (taskId: string, type: ArtifactType) => {
    const task = activeTasks.find((t) => t.taskId === taskId)
    if (!task) return
    try {
      await cancelTask(task.taskId)
      show({ type: 'info', message: `${type.replace('_', ' ')} generation cancelled` })
    } catch {
      show({ type: 'error', message: 'Failed to cancel task' })
    }
  }

  const handleDownload = async (artifact: Artifact) => {
    const fmt = DOWNLOAD_FORMATS[artifact.type]
    const label = artifact.title || ARTIFACT_TYPES.find((a) => a.type === artifact.type)?.label || artifact.type
    const filename = `${label.replace(/\s+/g, '_')}.${fmt.ext}`
    try {
      const destPath = await ipc.openSaveDialog(filename, [{ name: fmt.label, extensions: [fmt.ext] }])
      if (!destPath) return
      await ipc.downloadArtifact(notebookId, artifact.type, destPath, fmt.format)
      const notebookTitle = notebooks.find((n) => n.id === notebookId)?.title ?? ''
      try {
        const record = await ipc.recordDownload(notebookId, notebookTitle, artifact.type, fmt.format, destPath)
        addDownload(record)
        show({ type: 'success', message: `Saved ${filename}`, undoLabel: 'Show in Finder', onUndo: () => ipc.revealDownload(record.id).catch(() => {}), duration: 6000 })
      } catch {
        show({ type: 'success', message: `Saved ${filename}` })
      }
    } catch (e) {
      show({ type: 'error', message: `Download failed: ${String(e)}` })
    }
  }

  const handleRename = (artifact: Artifact) => {
    setRenameTarget(artifact)
  }

  const handleDelete = (artifact: Artifact) => {
    deleteArtifact(notebookId, artifact.id)
  }

  // Artifacts to show in the bottom list (all non-none statuses)
  const listedArtifacts = notebookArtifacts.filter(
    (a) => a.status === 'ready' || a.status === 'generating' || a.status === 'error'
  )

  // For the top grid: show generating state if any task of that type is active
  const getTypeStatus = (type: ArtifactType) => {
    const task = activeTasks.find((t) => t.notebookId === notebookId && t.artifactType === type)
    if (task) return { status: 'generating' as const, progress: task.progress }
    const ready = notebookArtifacts.find((a) => a.type === type && a.status === 'ready')
    if (ready) return { status: 'ready' as const, progress: 100 }
    const err = notebookArtifacts.find((a) => a.type === type && a.status === 'error')
    if (err) return { status: 'error' as const, progress: 0 }
    return { status: 'none' as const, progress: 0 }
  }

  const notebook = notebooks.find((n) => n.id === notebookId)

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">

      {/* ── Top: Generate buttons ── */}
      <div className="flex flex-col overflow-hidden shrink-0" style={{ height: topHeight }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Generate
          </span>
          {loading[notebookId] && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            {ARTIFACT_TYPES.map((meta) => {
              const { status, progress } = getTypeStatus(meta.type)
              const isGenerating = status === 'generating'

              return (
                <button
                  key={meta.type}
                  onClick={() => setModalType(meta.type)}
                  className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors relative overflow-hidden"
                  style={{
                    background: 'var(--color-elevated)',
                    border: `1px solid ${status === 'error' ? 'var(--color-error)' : 'var(--color-separator)'}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-app-bg)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-elevated)' }}
                >
                  {isGenerating && (
                    <div className="absolute bottom-0 left-0 h-0.5 rounded-full" style={{ width: `${progress}%`, background: 'var(--color-accent)', transition: 'width 400ms ease' }} />
                  )}
                  <span style={{
                    color: status === 'ready' ? '#34C759'
                      : status === 'error' ? 'var(--color-error)'
                      : 'var(--color-text-secondary)',
                  }}>
                    {meta.icon}
                  </span>
                  <span className="text-[11px] font-medium leading-tight" style={{
                    color: status === 'ready' ? 'var(--color-text-primary)'
                      : status === 'error' ? 'var(--color-error)'
                      : 'var(--color-text-secondary)',
                  }}>
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Drag handle ── */}
      <div
        onMouseDown={onDividerDrag}
        className="flex items-center justify-center shrink-0 cursor-ns-resize select-none"
        style={{ height: 12, borderTop: '1px solid var(--color-separator)', borderBottom: '1px solid var(--color-separator)' }}
      >
        <div className="w-8 h-0.5 rounded-full" style={{ background: 'var(--color-separator)' }} />
      </div>

      {/* ── Bottom: Generated artifacts list ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        <div className="px-4 pt-3 pb-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Generated
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
          {listedArtifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
              <span className="text-2xl opacity-30">✨</span>
              <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                Generated artifacts will appear here
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {listedArtifacts.map((artifact) => {
                const meta = ARTIFACT_TYPES.find((m) => m.type === artifact.type)!
                return (
                  <ArtifactRow
                    key={artifact.id}
                    meta={meta}
                    artifact={artifact}
                    onOpen={() => openCanvas(notebookId, artifact.type)}
                    onDownload={() => handleDownload(artifact)}
                    onCancel={() => artifact.task_id && handleCancel(artifact.task_id, artifact.type)}
                    onRename={() => handleRename(artifact)}
                    onDelete={() => handleDelete(artifact)}
                    onShare={() => setShareOpen(true)}
                    onRetry={() => setModalType(artifact.type)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      <AP>
        {modalType && (
          <GenerateModal
            artifactType={modalType}
            sources={notebookSources}
            onClose={() => setModalType(null)}
            onGenerate={handleGenerate}
          />
        )}
      </AP>

      {shareOpen && notebook && (
        <ShareModal
          notebookId={notebookId}
          notebookTitle={notebook.title}
          onClose={() => setShareOpen(false)}
        />
      )}

      {renameTarget && (
        <RenameModal
          artifact={renameTarget}
          defaultLabel={ARTIFACT_TYPES.find((m) => m.type === renameTarget.type)?.label ?? renameTarget.type}
          onClose={() => setRenameTarget(null)}
          onConfirm={(title) => {
            renameArtifact(notebookId, renameTarget.id, title)
            setRenameTarget(null)
          }}
        />
      )}
    </div>
  )
}

// ── Artifact row ──────────────────────────────────────────────────────────────

function ArtifactRow({ meta, artifact, onOpen, onDownload, onCancel, onRename, onDelete, onShare, onRetry }: {
  meta: ArtifactMeta
  artifact: Artifact
  onOpen: () => void
  onDownload: () => void
  onCancel: () => void
  onRename: () => void
  onDelete: () => void
  onShare: () => void
  onRetry: () => void
}) {
  const { status, progress = 0 } = artifact
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const displayTitle = artifact.title && artifact.title !== artifact.type
    ? artifact.title
    : meta.label

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--color-elevated)',
        border: `1px solid ${status === 'generating' ? 'rgba(0,122,255,0.25)' : status === 'error' ? 'var(--color-error)' : 'var(--color-separator)'}`,
      }}
    >
      {/* Icon */}
      <span className="shrink-0" style={{
        color: status === 'generating' ? 'var(--color-accent)'
          : status === 'ready' ? '#34C759'
          : status === 'error' ? 'var(--color-error)'
          : 'var(--color-text-tertiary)',
      }}>
        {status === 'generating' ? <Loader2 size={14} className="animate-spin" /> : meta.icon}
      </span>

      {/* Label + progress */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{displayTitle}</p>
        {status === 'generating' && (
          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-separator)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--color-accent)', transition: 'width 400ms ease' }} />
          </div>
        )}
        {status === 'error' && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-error)' }}>Failed</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {status === 'ready' && (
          <>
            <IconBtn icon={<Play size={11} />} title="Open" onClick={onOpen} />
            <IconBtn icon={<Download size={11} />} title="Download" onClick={onDownload} />
            <div ref={menuRef} className="relative">
              <IconBtn
                icon={<MoreHorizontal size={11} />}
                title="More options"
                onClick={() => setMenuOpen((v) => !v)}
              />
              <AP>
                {menuOpen && (
                  <ContextMenu
                    onRename={() => { setMenuOpen(false); onRename() }}
                    onDownload={() => { setMenuOpen(false); onDownload() }}
                    onShare={() => { setMenuOpen(false); onShare() }}
                    onDelete={() => { setMenuOpen(false); onDelete() }}
                  />
                )}
              </AP>
            </div>
          </>
        )}
        {status === 'generating' && (
          <IconBtn icon={<X size={11} />} title="Cancel" onClick={onCancel} danger />
        )}
        {status === 'error' && (
          <>
            <IconBtn icon={<AlertCircle size={11} />} title="Retry" onClick={onRetry} danger />
            <div ref={menuRef} className="relative">
              <IconBtn
                icon={<MoreHorizontal size={11} />}
                title="More options"
                onClick={() => setMenuOpen((v) => !v)}
              />
              <AP>
                {menuOpen && (
                  <ContextMenu
                    onRename={() => { setMenuOpen(false); onRename() }}
                    onDownload={() => { setMenuOpen(false); onDownload() }}
                    onShare={() => { setMenuOpen(false); onShare() }}
                    onDelete={() => { setMenuOpen(false); onDelete() }}
                  />
                )}
              </AP>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

function ContextMenu({ onRename, onDownload, onShare, onDelete }: {
  onRename: () => void
  onDownload: () => void
  onShare: () => void
  onDelete: () => void
}) {
  const items = [
    { icon: <Pencil size={11} />, label: 'Rename', action: onRename },
    { icon: <Download size={11} />, label: 'Download', action: onDownload },
    { icon: <Share2 size={11} />, label: 'Share', action: onShare },
    { icon: <Trash2 size={11} />, label: 'Delete', action: onDelete, danger: true },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.1 }}
      className="absolute right-0 top-full mt-1 rounded-xl border overflow-hidden z-50"
      style={{
        background: 'var(--color-elevated)',
        borderColor: 'var(--color-separator)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: 140,
      }}
    >
      {items.map(({ icon, label, action, danger }) => (
        <button
          key={label}
          onClick={action}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors"
          style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-primary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-app-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          {icon}
          {label}
        </button>
      ))}
    </motion.div>
  )
}

// ── Icon button ───────────────────────────────────────────────────────────────

function IconBtn({ icon, title, onClick, danger }: { icon: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-app-bg)'; e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-primary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
    >
      {icon}
    </button>
  )
}
