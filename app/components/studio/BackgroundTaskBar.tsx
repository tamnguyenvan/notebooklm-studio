'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, X, RefreshCw } from 'lucide-react'
import { useArtifactStore } from '../../stores/artifactStore'
import { useToastStore } from '../../stores/toastStore'

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
  const [collapsed, setCollapsed] = useState(false)

  if (activeTasks.length === 0) return null

  const handleCancel = async (taskId: string) => {
    try {
      await cancelTask(taskId)
      show({ type: 'info', message: 'Generation cancelled' })
    } catch (e) {
      show({ type: 'error', message: `Cancel failed: ${String(e)}` })
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t"
      style={{
        background: 'var(--color-elevated)',
        borderColor: 'var(--color-separator)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-4 py-2.5 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-accent)' }} />
        <span className="flex-1 text-xs font-medium text-left" style={{ color: 'var(--color-text-primary)' }}>
          {activeTasks.length} task{activeTasks.length > 1 ? 's' : ''} running
        </span>
        {collapsed ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                   : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)' }} />}
      </button>

      {/* Task list */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 px-4 pb-3">
              {activeTasks.map((task) => (
                <div key={task.taskId} className="flex items-center gap-3">
                  <span className="text-base w-5 shrink-0">{TYPE_ICONS[task.artifactType] ?? '⚙'}</span>
                  <span className="text-xs w-28 shrink-0 truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {TYPE_LABELS[task.artifactType] ?? task.artifactType}
                  </span>

                  {/* Progress bar */}
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-separator)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${task.progress}%`,
                        background: 'var(--color-accent)',
                        transition: 'width 400ms ease',
                      }}
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
      </AnimatePresence>
    </motion.div>
  )
}
