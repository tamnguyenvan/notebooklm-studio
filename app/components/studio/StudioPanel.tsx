'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import {
  Mic, Video, Presentation, HelpCircle, CreditCard,
  Image, FileText, Table, GitBranch,
  Play, RefreshCw, AlertCircle, Loader2,
} from 'lucide-react'
import { useArtifactStore } from '../../stores/artifactStore'
import { useToastStore } from '../../stores/toastStore'
import { ws } from '../../lib/ws'
import { ArtifactType, Artifact, GenerateConfig } from '../../lib/ipc'
import { GenerateModal } from './GenerateModal'

interface Props {
  notebookId: string
}

interface ArtifactMeta {
  type: ArtifactType
  label: string
  description: string
  icon: React.ReactNode
  thumbnail: string | null
}

const ARTIFACT_TYPES: ArtifactMeta[] = [
  {
    type: 'audio',
    label: 'Audio Overview',
    description: 'Summarize your notes into an audio podcast',
    icon: <Mic size={16} />,
    thumbnail: '/thumbnails/audio.png',
  },
  {
    type: 'video',
    label: 'Video Summary',
    description: 'Generate a video summary of your notebook',
    icon: <Video size={16} />,
    thumbnail: '/thumbnails/video.png',
  },
  {
    type: 'slides',
    label: 'Slides',
    description: 'Create a slide deck from your notes',
    icon: <Presentation size={16} />,
    thumbnail: '/thumbnails/slides.png',
  },
  {
    type: 'quiz',
    label: 'Quiz',
    description: 'Generate quiz questions to test knowledge',
    icon: <HelpCircle size={16} />,
    thumbnail: '/thumbnails/quiz.png',
  },
  {
    type: 'flashcards',
    label: 'Flashcards',
    description: 'Create flashcards for studying',
    icon: <CreditCard size={16} />,
    thumbnail: '/thumbnails/flashcards.png',
  },
  {
    type: 'infographic',
    label: 'Infographic',
    description: 'Generate a visual infographic',
    icon: <Image size={16} />,
    thumbnail: '/thumbnails/infographic.png',
  },
  {
    type: 'report',
    label: 'Report',
    description: 'Generate a detailed report',
    icon: <FileText size={16} />,
    thumbnail: '/thumbnails/report.png',
  },
  {
    type: 'data_table',
    label: 'Data Table',
    description: 'Extract structured data from sources',
    icon: <Table size={16} />,
    thumbnail: '/thumbnails/data_table.png',
  },
  {
    type: 'mind_map',
    label: 'Mind Map',
    description: 'Generate a visual mind map',
    icon: <GitBranch size={16} />,
    thumbnail: '/thumbnails/mind_map.png',
  },
]

export function StudioPanel({ notebookId }: Props) {
  const { artifacts, loading, fetchArtifacts, generate, onTaskProgress, onTaskComplete, onTaskError, openCanvas } = useArtifactStore()
  const { show } = useToastStore()
  const [modalType, setModalType] = useState<ArtifactType | null>(null)

  const notebookArtifacts = artifacts[notebookId] ?? []

  useEffect(() => {
    fetchArtifacts(notebookId)
  }, [notebookId])

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
      await generate(notebookId, config)
    } catch (e) {
      show({ type: 'error', message: `Failed to start generation: ${String(e)}` })
    }
  }

  const getArtifact = (type: ArtifactType): Artifact | undefined =>
    notebookArtifacts.find((a) => a.type === type)

  if (loading[notebookId] && notebookArtifacts.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-6 pt-6 pb-2">
          <div className="h-5 w-48 rounded-lg animate-pulse" style={{ background: 'var(--color-separator)' }} />
          <div className="h-3.5 w-64 rounded-lg animate-pulse mt-2" style={{ background: 'var(--color-separator)' }} />
        </div>
        <div className="px-6 pb-6 pt-3 grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--color-separator)', background: 'var(--color-elevated)' }}
            >
              <div className="animate-pulse" style={{ height: 88, background: 'var(--color-separator)' }} />
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded animate-pulse" style={{ background: 'var(--color-separator)' }} />
                  <div className="h-4 w-24 rounded animate-pulse" style={{ background: 'var(--color-separator)' }} />
                </div>
                <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--color-separator)' }} />
                <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: 'var(--color-separator)' }} />
                <div className="h-7 w-full rounded-lg animate-pulse mt-1" style={{ background: 'var(--color-separator)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            AI-Powered Artifacts
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Generate useful content from your notebook
          </p>
        </div>
        {loading[notebookId] && (
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
        )}
      </div>

      <div className="px-6 pb-6 pt-3 grid grid-cols-3 gap-3">
        {ARTIFACT_TYPES.map((meta) => {
          const artifact = getArtifact(meta.type)
          const status = artifact?.status ?? 'none'
          const progress = artifact?.progress ?? 0

          return (
            <ArtifactCard
              key={meta.type}
              meta={meta}
              status={status}
              progress={progress}
              artifactTitle={artifact?.title}
              onGenerate={() => setModalType(meta.type)}
              onPreview={() => openCanvas(notebookId, meta.type)}
              onRegenerate={() => setModalType(meta.type)}
            />
          )
        })}
      </div>

      <AP>
        {modalType && (
          <GenerateModal
            artifactType={modalType}
            onClose={() => setModalType(null)}
            onGenerate={handleGenerate}
          />
        )}
      </AP>
    </div>
  )
}

// ── Artifact Card ─────────────────────────────────────────────────────────────

interface CardProps {
  meta: ArtifactMeta
  status: 'none' | 'generating' | 'ready' | 'error'
  progress: number
  artifactTitle?: string
  onGenerate: () => void
  onPreview: () => void
  onRegenerate: () => void
}

function ArtifactCard({ meta, status, progress, artifactTitle, onGenerate, onPreview, onRegenerate }: CardProps) {
  const [imgError, setImgError] = useState(false)

  const borderColor = status === 'generating'
    ? 'rgba(0,122,255,0.35)'
    : status === 'error'
    ? 'var(--color-error)'
    : 'var(--color-separator)'

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-elevated)',
        border: `1px solid ${borderColor}`,
        boxShadow: status === 'generating' ? '0 0 0 3px rgba(0,122,255,0.08)' : 'var(--shadow-sm)',
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: 88,
          background: 'var(--color-app-bg)',
          borderBottom: '1px solid var(--color-separator)',
        }}
      >
        {meta.thumbnail && !imgError ? (
          <img
            src={meta.thumbnail}
            alt={meta.label}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            style={{ opacity: 0.85 }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span style={{ color: 'var(--color-text-tertiary)', opacity: 0.5 }}>
              {/* scale up the icon for placeholder */}
              {meta.icon}
            </span>
          </div>
        )}

        {/* Generating overlay */}
        {status === 'generating' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            <Loader2 size={18} className="animate-spin text-white" />
            <span className="text-xs font-semibold text-white">{progress}%</span>
            <div className="w-3/4 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: 'var(--color-accent)',
                  transition: 'width 400ms ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Ready badge */}
        {status === 'ready' && (
          <div
            className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(52,199,89,0.15)', color: '#34C759' }}
          >
            Ready
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        {/* Title row */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>{meta.icon}</span>
          <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {meta.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
          {meta.description}
        </p>

        {/* Action */}
        <div className="mt-auto pt-1">
          {status === 'none' && (
            <button
              onClick={onGenerate}
              className="w-full rounded-lg py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: 'var(--color-accent)' }}
            >
              Generate
            </button>
          )}

          {status === 'generating' && (
            <button
              disabled
              className="w-full rounded-lg py-1.5 text-xs font-semibold"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', cursor: 'not-allowed' }}
            >
              Generating…
            </button>
          )}

          {status === 'ready' && (
            <div className="flex gap-1.5">
              <button
                onClick={onPreview}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85"
                style={{ background: 'var(--color-accent)' }}
              >
                <Play size={11} />
                Open
              </button>
              <button
                onClick={onRegenerate}
                className="flex items-center justify-center rounded-lg px-2.5 py-1.5 transition-colors"
                style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)', color: 'var(--color-text-secondary)' }}
                title="Regenerate"
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              >
                <RefreshCw size={12} />
              </button>
            </div>
          )}

          {status === 'error' && (
            <button
              onClick={onGenerate}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors"
              style={{ background: 'rgba(255,69,58,0.1)', color: 'var(--color-error)' }}
            >
              <AlertCircle size={12} />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
