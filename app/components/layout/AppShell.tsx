'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { NotebookList } from '../notebooks/NotebookList'
import { NotebookScreen } from './NotebookScreen'
import { LibraryScreen } from '../library/LibraryScreen'
import { SettingsScreen } from '../settings/SettingsScreen'
import { StudioPanel } from '../studio/StudioPanel'
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

const STUDIO_MIN = 200
const STUDIO_MAX = 520
const STUDIO_DEFAULT = 260

export function AppShell() {
  const { activeNotebookId, setActiveNotebook } = useNotebookStore()
  const handleKeyDown = useShortcutStore((s) => s.handleKeyDown)
  const { view, loadPrefs, setView } = useUIStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [studioOpen, setStudioOpen] = useState(false)
  const [studioWidth, setStudioWidth] = useState(STUDIO_DEFAULT)
  const [newNotebookOpen, setNewNotebookOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Horizontal resize of studio panel (drag handle on left edge)
  const onResizeDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = studioWidth
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(STUDIO_MIN, Math.min(STUDIO_MAX, startW + (startX - ev.clientX)))
      setStudioWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [studioWidth])

  useEffect(() => {
    loadPrefs().then(() => {
      const { lastActiveNotebookId: nbId, view: savedView } = useUIStore.getState()
      if (savedView === 'notebooks' && nbId) setActiveNotebook(nbId)
    })
    appStore.get<string>('settings.theme').then((t) => {
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
      else if (t === 'light') document.documentElement.setAttribute('data-theme', 'light')
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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

  useShortcut('palette',        useCallback(() => setPaletteOpen(true), []))
  useShortcut('settings',       handleSettingsOpen)
  useShortcut('new_notebook',   useCallback(() => setNewNotebookOpen(true), []))
  useShortcut('toggle_sidebar', useCallback(() => setSidebarOpen((v) => !v), []))
  useShortcut('toggle_theme',   handleToggleTheme)
  useShortcut('tab_studio',     useCallback(() => setStudioOpen((v) => !v), []))

  const handlePaletteAddSource = useCallback((type: 'url' | 'youtube' | 'file' | 'text' | 'gdrive') => {
    window.dispatchEvent(new CustomEvent('palette:add_source', { detail: type }))
  }, [])
  const handlePaletteGenerate = useCallback((type: ArtifactType) => {
    window.dispatchEvent(new CustomEvent('palette:generate', { detail: type }))
  }, [])
  const handlePaletteSwitchTab = useCallback((tab: 'chat' | 'sources' | 'studio' | 'research' | 'notes') => {
    if (tab === 'studio') setStudioOpen(true)
    else window.dispatchEvent(new CustomEvent('palette:switch_tab', { detail: tab }))
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
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--color-app-bg)' }}>
      <TitleBar
        onSettingsOpen={handleSettingsOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        onToggleStudio={() => setStudioOpen((v) => !v)}
        studioOpen={studioOpen}
      />

      {/* Body: sidebar | content | studio panel — all full height below titlebar */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onLibraryOpen={handleLibraryOpen} onAllNotebooks={handleAllNotebooks} open={sidebarOpen} />

        <main className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--color-content-bg)' }}>
          {renderMain()}
        </main>

        {/* Right: Studio panel — full height, resizable */}
        <AP initial={false}>
          {studioOpen && (
            <motion.div
              key="studio-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: studioWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex h-full shrink-0 overflow-hidden"
              style={{ borderLeft: '1px solid var(--color-separator)', background: 'var(--color-sidebar-bg)' }}
            >
              {/* Drag handle on left edge */}
              <div
                onMouseDown={onResizeDrag}
                className="w-1 h-full shrink-0 cursor-ew-resize select-none transition-colors"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              />

              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                {activeNotebookId ? (
                  <StudioPanel notebookId={activeNotebookId} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Open a notebook to use Studio</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AP>
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
