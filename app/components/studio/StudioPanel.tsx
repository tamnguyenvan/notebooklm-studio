'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Download, RefreshCw, AlertCircle } from 'lucide-react'
import { useArtifactStore } from '../../stores/artifactStore'
import { useToastStore } from '../../stores/toastStore'
import { ws } from '../../lib/ws'
import { ArtifactType, Artifact, GenerateConfig } from '../../lib/ipc'
import { GenerateModal } from './GenerateModal'

interface Props {
  notebookId: string
}

const ARTIFACT_TYPES: { type: ArtifactType; label: string; icon: string }[] = [
  { type: 'audio',       label: 'Audio Overview', icon: '🎙' },
  { type: 'video',       label: 'Video Overview',  icon: '📹' },
  { type: 'slides',      label: 'Slide Deck',      icon: '📑' },
  { type: 'quiz',        label: 'Quiz',            icon: '❓' },
  { type: 'flashcards',  label: 'Flashcards',      icon: '🃏' },
  { type: 'infographic', label: 'Infographic',     icon: '🖼' },
  { type: 'report',      label: 'Report',          icon: '📄' },
  { type: 'data_table',  label: 'Data Table',      icon: '📊' },
  { type: 'mind_map',    label: 'Mind Map',        icon: '🧠' },
]

export function StudioPanel({ notebookId }: Props) {
  const { artifacts, loading, fetchArtifacts, generate, onTaskProgress, onTaskComplete, onTaskError, openCanvas } = useArtifactStore()
  const { show } = useToastStore()
  const [modalType, setModalType] = useState<ArtifactType | null>(null)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})

  const notebookArtifacts = artifacts[notebookId] ?? []

  useEffect(() => {
    fetchArtifacts(notebookId)
  }, [notebookId])

  // Subscribe to WS task events
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
    setGenerating((g) => ({ ...g, [config.type]: true }))
    try {
      await generate(notebookId, config)
    } catch (e) {
      show({ type: 'error', message: `Failed to start generation: ${String(e)}` })
    } finally {
      setGenerating((g) => ({ ...g, [config.type]: false }))
    }
  }

  const getArtifact = (type: ArtifactType): Artifact | undefined =>
    notebookArtifacts.find((a) => a.type === type)

  if (loading[notebookId]) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className="grid grid-cols-3 gap-4 max-w-3xl">
        {ARTIFACT_TYPES.map(({ type, label, icon }) => {
          const artifact = getArtifact(type)
          const status = artifact?.status ?? 'none'
          const progress = artifact?.progress ?? 0

          return (
            <ArtifactCard
              key={type}
              type={type}
              label={label}
              icon={icon}
              status={status}
              progress={progress}
              artifactTitle={artifact?.title}
              onGenerate={() => setModalType(type)}
              onPreview={() => openCanvas(notebookId, type)}
              onRegenerate={() => setModalType(type)}
            />
          )
        })}
      </div>

      {/* Generation modal */}
      <AnimatePresence>
        {modalType && (
          <GenerateModal
            artifactType={modalType}
            onClose={() => setModalType(null)}
            onGenerate={handleGenerate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

interface CardProps {
  type: ArtifactType
  label: string
  icon: string
  status: 'none' | 'generating' | 'ready' | 'error'
  progress: number
  artifactTitle?: string
  onGenerate: () => void
  onPreview: () => void
  onRegenerate: () => void
}

function ArtifactCard({ type, label, icon, status, progress, artifactTitle, onGenerate, onPreview, onRegenerate }: CardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      className="relative rounded-xl overflow-hidden flex flex-col"
      style={{
        height: '160px',
        background: status === 'none' ? 'var(--color-elevated)' : 'var(--color-elevated)',
        border: status === 'generating'
          ? '1.5px solid rgba(0,122,255,0.4)'
          : status === 'error'
          ? '1.5px solid var(--color-error)'
          : '1.5px dashed var(--color-separator)',
        borderRadius: '14px',
        boxShadow: status === 'generating' ? '0 0 0 3px rgba(0,122,255,0.1)' : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={status !== 'generating' ? { scale: 1.02 } : {}}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
    >
      {status === 'none' && (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-3">
          <span className="text-3xl">{icon}</span>
          <span className="text-xs font-medium text-center" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
          <AnimatePresence>
            {hovered && (
              <motion.button
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                onClick={onGenerate}
                className="px-3 py-1 rounded-lg text-xs font-medium border transition-colors"
                style={{ borderColor: 'var(--color-separator)', color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                  e.currentTarget.style.borderColor = 'var(--color-separator)'
                }}
              >
                Generate
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {status === 'generating' && (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-3">
          {/* Progress ring */}
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-separator)" strokeWidth="3" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke="var(--color-accent)" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 400ms ease' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
              {progress}%
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Generating…</span>
        </div>
      )}

      {status === 'ready' && (
        <>
          {/* Thumbnail area */}
          <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-app-bg)' }}>
            <span className="text-4xl">{icon}</span>
          </div>
          {/* Bottom bar */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--color-separator)' }}>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {artifactTitle && artifactTitle !== type ? artifactTitle : label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onPreview} className="p-1.5 rounded transition-colors" style={{ color: 'var(--color-accent)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Preview">
                <Play className="w-3.5 h-3.5" />
              </button>
              <button onClick={onRegenerate} className="p-1.5 rounded transition-colors" style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Regenerate">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Hover overlay */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3"
                style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '14px' }}
              >
                <button onClick={onPreview}
                  className="w-full py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}>
                  Preview
                </button>
                <button onClick={onRegenerate}
                  className="w-full py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
                  Regenerate
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-3">
          <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-error)' }} />
          <span className="text-xs text-center" style={{ color: 'var(--color-error)' }}>Generation failed</span>
          <button onClick={onGenerate}
            className="px-3 py-1 rounded-lg text-xs font-medium border"
            style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
            Retry
          </button>
        </div>
      )}
    </motion.div>
  )
}
