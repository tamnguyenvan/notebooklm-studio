'use client'

import { useState, useEffect, useCallback } from 'react'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { NotebookList } from '../notebooks/NotebookList'
import { NotebookScreen } from './NotebookScreen'
import { LibraryScreen } from '../library/LibraryScreen'
import { SettingsScreen } from '../settings/SettingsScreen'
import { NewNotebookModal } from '../notebooks/NewNotebookModal'
import { CommandPalette } from '../ui/CommandPalette'
import { DragOverlay } from '../sources/DragOverlay'
import { ToastContainer } from '../ui/ToastContainer'
import { useNotebookStore } from '../../stores/notebookStore'
import { useShortcutStore } from '../../stores/shortcutStore'
import { useShortcut } from '../../lib/useShortcut'
import { ArtifactType } from '../../lib/ipc'

type View = 'notebooks' | 'library' | 'settings'

export function AppShell() {
  const { activeNotebookId, setActiveNotebook } = useNotebookStore()
  const handleKeyDown = useShortcutStore((s) => s.handleKeyDown)
  const [view, setView] = useState<View>('notebooks')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [newNotebookOpen, setNewNotebookOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Mount global shortcut listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close library/settings when a notebook is selected
  useEffect(() => {
    if (activeNotebookId != null) setView('notebooks')
  }, [activeNotebookId])

  const handleLibraryOpen = useCallback(() => { setView('library'); setActiveNotebook(null) }, [setActiveNotebook])
  const handleSettingsOpen = useCallback(() => { setView('settings'); setActiveNotebook(null) }, [setActiveNotebook])
  const handleAllNotebooks = useCallback(() => { setView('notebooks'); setActiveNotebook(null) }, [setActiveNotebook])
  const handleToggleTheme = useCallback(() => {
    const root = document.documentElement
    const isDark = root.getAttribute('data-theme') === 'dark'
    root.setAttribute('data-theme', isDark ? 'light' : 'dark')
    localStorage.setItem('settings.theme', isDark ? 'light' : 'dark')
  }, [])

  // Register app-level shortcuts
  useShortcut('palette', useCallback(() => setPaletteOpen(true), []))
  useShortcut('settings', handleSettingsOpen)
  useShortcut('new_notebook', useCallback(() => setNewNotebookOpen(true), []))
  useShortcut('toggle_sidebar', useCallback(() => setSidebarOpen((v) => !v), []))
  useShortcut('toggle_theme', handleToggleTheme)

  // Palette → notebook-context actions dispatched as custom events
  // NotebookScreen listens for these
  const handlePaletteAddSource = useCallback((type: 'url' | 'youtube' | 'file' | 'text' | 'gdrive') => {
    window.dispatchEvent(new CustomEvent('palette:add_source', { detail: type }))
  }, [])

  const handlePaletteGenerate = useCallback((type: ArtifactType) => {
    window.dispatchEvent(new CustomEvent('palette:generate', { detail: type }))
  }, [])

  const handlePaletteSwitchTab = useCallback((tab: 'chat' | 'sources' | 'studio' | 'research' | 'notes') => {
    window.dispatchEvent(new CustomEvent('palette:switch_tab', { detail: tab }))
  }, [])

  const handlePaletteNewNote = useCallback(() => {
    window.dispatchEvent(new CustomEvent('palette:new_note'))
  }, [])

  const renderMain = () => {
    if (view === 'library') return <LibraryScreen />
    if (view === 'settings') return <SettingsScreen />
    if (activeNotebookId != null) return <NotebookScreen notebookId={activeNotebookId} />
    return <NotebookList onNewNotebook={() => setNewNotebookOpen(true)} />
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-app-bg)' }}
    >
      <TitleBar onSettingsOpen={handleSettingsOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar onLibraryOpen={handleLibraryOpen} onAllNotebooks={handleAllNotebooks} open={sidebarOpen} />

        <main
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: 'var(--color-content-bg)' }}
        >
          {renderMain()}
        </main>
      </div>

      <DragOverlay notebookId={activeNotebookId} />
      <ToastContainer />
      <NewNotebookModal open={newNotebookOpen} onClose={() => setNewNotebookOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewNotebook={() => setNewNotebookOpen(true)}
        onOpenSettings={handleSettingsOpen}
        onOpenLibrary={handleLibraryOpen}
        onAllNotebooks={handleAllNotebooks}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleTheme={handleToggleTheme}
        onAddSource={handlePaletteAddSource}
        onGenerate={handlePaletteGenerate}
        onSwitchTab={handlePaletteSwitchTab}
        onNewNote={handlePaletteNewNote}
      />
    </div>
  )
}
