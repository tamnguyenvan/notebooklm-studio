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
import { useUIStore } from '../../stores/uiStore'
import { appStore } from '../../stores/appStore'

type View = 'notebooks' | 'library' | 'settings'

export function AppShell() {
  const { activeNotebookId, setActiveNotebook, fetchNotebooks } = useNotebookStore()
  const handleKeyDown = useShortcutStore((s) => s.handleKeyDown)
  const { view, lastActiveNotebookId, prefsLoaded, loadPrefs, setView } = useUIStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [newNotebookOpen, setNewNotebookOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Load persisted UI prefs + theme on mount
  useEffect(() => {
    loadPrefs().then(() => {
      // Restore last active notebook after prefs are loaded
      const { lastActiveNotebookId: nbId, view: savedView } = useUIStore.getState()
      if (savedView === 'notebooks' && nbId) {
        setActiveNotebook(nbId)
      }
    })
    // Restore theme
    appStore.get<string>('settings.theme').then((t) => {
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
      else if (t === 'light') document.documentElement.setAttribute('data-theme', 'light')
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mount global shortcut listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close library/settings when a notebook is selected; persist the change
  useEffect(() => {
    if (activeNotebookId != null) setView('notebooks', activeNotebookId)
  }, [activeNotebookId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLibraryOpen = useCallback(() => { setView('library'); setActiveNotebook(null) }, [setView, setActiveNotebook])
  const handleSettingsOpen = useCallback(() => { setView('settings'); setActiveNotebook(null) }, [setView, setActiveNotebook])
  const handleAllNotebooks = useCallback(() => { setView('notebooks', null); setActiveNotebook(null) }, [setView, setActiveNotebook])
  const handleToggleTheme = useCallback(() => {
    const root = document.documentElement
    const isDark = root.getAttribute('data-theme') === 'dark'
    root.setAttribute('data-theme', isDark ? 'light' : 'dark')
    void appStore.set('settings.theme', isDark ? 'light' : 'dark')
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
