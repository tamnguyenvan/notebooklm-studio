'use client'

import { useState, useEffect } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { NotebookList } from '../notebooks/NotebookList'
import { NotebookScreen } from './NotebookScreen'
import { LibraryScreen } from '../library/LibraryScreen'
import { DragOverlay } from '../sources/DragOverlay'
import { ToastContainer } from '../ui/ToastContainer'
import { useNotebookStore } from '../../stores/notebookStore'

export function AppShell() {
  const { activeNotebookId, setActiveNotebook } = useNotebookStore()
  const [libraryOpen, setLibraryOpen] = useState(false)

  // Close library when a notebook is selected
  useEffect(() => {
    if (activeNotebookId != null) setLibraryOpen(false)
  }, [activeNotebookId])

  const handleLibraryOpen = () => {
    setLibraryOpen(true)
    setActiveNotebook(null)
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-app-bg)' }}
    >
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar onLibraryOpen={handleLibraryOpen} />

        <main
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: 'var(--color-content-bg)' }}
        >
          {libraryOpen ? (
            <LibraryScreen />
          ) : activeNotebookId == null ? (
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
