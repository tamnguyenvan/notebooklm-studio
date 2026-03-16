'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useNotebookStore } from '../../stores/notebookStore'

const EMOJIS = ['📓','📔','📒','📕','📗','📘','📙','🗒️','📋','📄','📑','🗂️',
  '💡','🔬','🧪','🎯','🚀','🌍','🎨','🎵','💻','🤖','🧠','⚡']

interface Props {
  open: boolean
  onClose: () => void
}

export function NewNotebookModal({ open, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('📓')
  const [loading, setLoading] = useState(false)
  const { createNotebook, setActiveNotebook } = useNotebookStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setEmoji('📓')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleCreate = async () => {
    const t = title.trim() || 'Untitled notebook'
    setLoading(true)
    try {
      const nb = await createNotebook(t, emoji)
      setActiveNotebook(nb.id)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed left-1/2 top-1/2 z-[101] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
            style={{
              background: 'var(--color-elevated)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                New notebook
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-separator)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Emoji picker */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
              Icon
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all"
                  style={{
                    background: emoji === e ? 'var(--color-accent-subtle)' : 'transparent',
                    outline: emoji === e ? '2px solid var(--color-accent)' : 'none',
                    outlineOffset: '-1px',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Title input */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
              Title
            </p>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Untitled notebook"
              maxLength={100}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{
                background: 'var(--color-app-bg)',
                border: '1px solid var(--color-separator)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-separator)')}
            />

            {/* Footer */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-separator)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: 'var(--color-accent)' }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--color-accent-hover)' }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--color-accent)' }}
              >
                {loading ? 'Creating…' : 'Create notebook'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
