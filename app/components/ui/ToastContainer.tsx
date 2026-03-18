'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'

const ICONS = {
  success: <CheckCircle size={15} />,
  error:   <AlertCircle size={15} />,
  warning: <AlertTriangle size={15} />,
  info:    <Info size={15} />,
  undo:    <Info size={15} />,
}

const COLORS: Record<string, string> = {
  success: 'var(--color-success)',
  error:   'var(--color-error)',
  warning: 'var(--color-warning)',
  info:    'var(--color-accent)',
  undo:    'var(--color-text-primary)',
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            className="pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'var(--color-elevated)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-separator)',
              color: 'var(--color-text-primary)',
              minWidth: 260,
              maxWidth: 400,
            }}
          >
            <span style={{ color: COLORS[toast.type] }}>{ICONS[toast.type]}</span>
            <span className="flex-1">{toast.message}</span>
            {toast.onUndo && (
              <button
                onClick={() => { toast.onUndo!(); dismiss(toast.id) }}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent)',
                }}
              >
                {toast.undoLabel ?? 'Undo'}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-md p-0.5 transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
