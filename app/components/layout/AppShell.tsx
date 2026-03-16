'use client'

import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { NotebookList } from '../notebooks/NotebookList'
import { ToastContainer } from '../ui/ToastContainer'
import { useNotebookStore } from '../../stores/notebookStore'

export function AppShell() {
  const { activeNotebookId } = useNotebookStore()

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-app-bg)' }}
    >
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: 'var(--color-content-bg)' }}
        >
          {activeNotebookId == null ? (
            <NotebookList />
          ) : (
            // Placeholder — replaced in Module 3+ with the notebook screen
            <NotebookPlaceholder id={activeNotebookId} />
          )}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}

function NotebookPlaceholder({ id }: { id: string }) {
  const { notebooks, setActiveNotebook } = useNotebookStore()
  const nb = notebooks.find((n) => n.id === id)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="text-5xl">{nb?.emoji ?? '📓'}</span>
      <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {nb?.title ?? 'Notebook'}
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Sources, Chat, Studio and more coming in the next modules.
      </p>
      <button
        onClick={() => setActiveNotebook(null)}
        className="mt-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
        style={{ color: 'var(--color-accent)', background: 'var(--color-accent-subtle)' }}
      >
        ← Back to notebooks
      </button>
    </div>
  )
}
