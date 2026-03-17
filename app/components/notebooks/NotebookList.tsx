'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useNotebookStore } from '../../stores/notebookStore'
import { NotebookCard } from './NotebookCard'
import { NewNotebookModal } from './NewNotebookModal'

export function NotebookList() {
  const { notebooks, loading, error, fetchNotebooks, setActiveNotebook } = useNotebookStore()
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchNotebooks()
  }, [fetchNotebooks])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex shrink-0 items-center px-6 py-4"
        style={{ borderBottom: '1px solid var(--color-separator)' }}
      >
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          All Notebooks
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && notebooks.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(255,69,58,0.08)', color: 'var(--color-error)' }}
          >
            {error}
          </div>
        )}

        {!loading && notebooks.length === 0 && !error && (
          <EmptyState onNew={() => setModalOpen(true)} />
        )}

        {notebooks.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
          >
            {notebooks.map((nb) => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                onClick={() => setActiveNotebook(nb.id)}
              />
            ))}
          </div>
        )}
      </div>

      <NewNotebookModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="text-6xl">📓</span>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          No notebooks yet
        </h2>
        <p className="mt-1 max-w-xs text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Your notebooks will appear here once you create one.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: 'var(--color-accent)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
      >
        <Plus size={15} />
        New Notebook
      </button>
    </div>
  )
}
