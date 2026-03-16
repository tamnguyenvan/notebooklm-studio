'use client'

import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { NotebookList } from '../notebooks/NotebookList'
import { NotebookScreen } from './NotebookScreen'
import { DragOverlay } from '../sources/DragOverlay'
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
            <NotebookScreen notebookId={activeNotebookId} />
          )}
        </main>
      </div>

      <DragOverlay notebookId={activeNotebookId} />
      <ToastContainer />
    </div>
  )
}
