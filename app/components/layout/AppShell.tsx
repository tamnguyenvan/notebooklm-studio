'use client'

import { useState, useEffect } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { NotebookList } from '../notebooks/NotebookList'
import { NotebookScreen } from './NotebookScreen'
import { LibraryScreen } from '../library/LibraryScreen'
import { SettingsScreen } from '../settings/SettingsScreen'
import { DragOverlay } from '../sources/DragOverlay'
import { ToastContainer } from '../ui/ToastContainer'
import { useNotebookStore } from '../../stores/notebookStore'

type View = 'notebooks' | 'library' | 'settings'

export function AppShell() {
  const { activeNotebookId, setActiveNotebook } = useNotebookStore()
  const [view, setView] = useState<View>('notebooks')

  // Close library/settings when a notebook is selected
  useEffect(() => {
    if (activeNotebookId != null) setView('notebooks')
  }, [activeNotebookId])

  const handleLibraryOpen = () => { setView('library'); setActiveNotebook(null) }
  const handleSettingsOpen = () => { setView('settings'); setActiveNotebook(null) }
  const handleAllNotebooks = () => { setView('notebooks'); setActiveNotebook(null) }

  const renderMain = () => {
    if (view === 'library') return <LibraryScreen />
    if (view === 'settings') return <SettingsScreen />
    if (activeNotebookId != null) return <NotebookScreen notebookId={activeNotebookId} />
    return <NotebookList />
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-app-bg)' }}
    >
      <TitleBar onSettingsOpen={handleSettingsOpen} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar onLibraryOpen={handleLibraryOpen} onAllNotebooks={handleAllNotebooks} />

        <main
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: 'var(--color-content-bg)' }}
        >
          {renderMain()}
        </main>
      </div>

      <DragOverlay notebookId={activeNotebookId} />
      <ToastContainer />
    </div>
  )
}
