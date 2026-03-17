'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, X, RefreshCw } from 'lucide-react'
import { useArtifactStore } from '../../stores/artifactStore'
import { useToastStore } from '../../stores/toastStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any

const TYPE_ICONS: Record<string, string> = {
  audio: '🎙', video: '📹', slides: '📑', infographic: '🖼',
  quiz: '❓', flashcards: '🃏', report: '📄', data_table: '📊', mind_map: '🧠',
}

const TYPE_LABELS: Record<string, string> = {
  audio: 'Audio Overview', video: 'Video Overview', slides: 'Slide Deck',
  infographic: 'Infographic', quiz: 'Quiz', flashcards: 'Flashcards',
  report: 'Report', data_table: 'Data Table', mind_map: 'Mind Map',
}

export function BackgroundTaskBar() {
  const { activeTasks, cancelTask } = useArtifactStore()
  const { show } = useToastStore()
  const [expanded, setExpanded] = useState(false)

  if (activeTasks.length === 0) return null

  const avgProgress = Math.round(
    activeTasks.reduce((sum, t) => sum + t.progress, 0) / activeTasks.length
  )

  const handleCancel = async (taskId: string) => {
    try {
      await cancelTask(taskId)
      show({ type: 'info', message: 'Generation cancelled' })
    } catch (e) {
      show({ type: 'error', message: `Cancel failed: ${String(e)}` })
    }
  }

  return (
    <div
      className="border-t shrink-0"
      style={{
        background: 'var(--color-elevated)',
        borderColor: 'var(--color-separator)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* Collapsed header row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--color-accent)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {activeTasks.length} task{activeTasks.length > 1 ? 's' : ''} running
        </span>

        {/* Mini progress bar */}
        <div className="flex-1 h-1 rounded-full overflow-hidden mx-1" style={{ background: 'var(--color-separator)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${avgProgress}%`, background: 'var(--color-accent)' }}
          />
        </div>

        <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
          {avgProgress}%
        </span>

        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
          : <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />}
      </button>

      {/* Expanded task list */}
      <AP>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 px-4 pb-3">
              {activeTasks.map((task) => (
                <div key={task.taskId} className="flex items-center gap-3">
                  <span className="text-base w-5 shrink-0">{TYPE_ICONS[task.artifactType] ?? '⚙'}</span>
                  <span className="text-xs w-28 shrink-0 truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {TYPE_LABELS[task.artifactType] ?? task.artifactType}
                  </span>

                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-separator)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${task.progress}%`, background: 'var(--color-accent)', transition: 'width 400ms ease' }}
                    />
                  </div>

                  <span className="text-xs w-8 text-right shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                    {task.progress}%
                  </span>

                  <button
                    onClick={() => handleCancel(task.taskId)}
                    className="p-1 rounded transition-colors shrink-0"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AP>
    </div>
  )
}
