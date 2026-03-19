'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { MessageSquare, BookOpen, Search, StickyNote, ChevronLeft, Share2 } from 'lucide-react'
import { useNotebookStore } from '../../stores/notebookStore'
import { SourcesPanel } from '../sources/SourcesPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { CanvasPanel } from '../studio/CanvasPanel'
import { ResearchPanel } from '../research/ResearchPanel'
import { NotesPanel } from '../notes/NotesPanel'
import { ShareModal } from '../sharing/ShareModal'
import { AddSourceModal } from '../sources/AddSourceModal'
import { GenerateModal } from '../studio/GenerateModal'
import { ws } from '../../lib/ws'
import { useShortcut } from '../../lib/useShortcut'
import { useArtifactStore } from '../../stores/artifactStore'
import { useSourceStore } from '../../stores/sourceStore'
import { ArtifactType, GenerateConfig } from '../../lib/ipc'

type TabId = 'chat' | 'sources' | 'research' | 'notes'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'chat',     label: 'Chat',     icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'sources',  label: 'Sources',  icon: <BookOpen className="w-4 h-4" /> },
  { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" /> },
  { id: 'notes',    label: 'Notes',    icon: <StickyNote className="w-4 h-4" /> },
]

interface Props {
  notebookId: string
}

export function NotebookScreen({ notebookId }: Props) {
  const { notebooks, setActiveNotebook, renameNotebook } = useNotebookStore()
  const { closeCanvas, canvasItem, generate, fetchArtifacts } = useArtifactStore()
  const { sources: allSources } = useSourceStore()
  const notebookSources = (allSources[notebookId] ?? []).filter((s) => s.status === 'ready')
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const [shareOpen, setShareOpen] = useState(false)
  const [addSourceOpen, setAddSourceOpen] = useState(false)
  const [addSourceType, setAddSourceType] = useState<'url' | 'youtube' | 'file' | 'text' | 'gdrive' | null>(null)
  const [generateType, setGenerateType] = useState<ArtifactType | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const nb = notebooks.find((n) => n.id === notebookId)

  useEffect(() => {
    ws.connect(8008)
    fetchArtifacts(notebookId, true)
  }, [notebookId])

  useEffect(() => {
    const onAddSource = (e: Event) => {
      const type = (e as CustomEvent).detail as 'url' | 'youtube' | 'file' | 'text' | 'gdrive'
      setAddSourceType(type)
      setAddSourceOpen(true)
    }
    const onGenerate = (e: Event) => {
      setGenerateType((e as CustomEvent).detail as ArtifactType)
    }
    const onSwitchTab = (e: Event) => {
      setActiveTab((e as CustomEvent).detail as TabId)
    }
    const onNewNote = () => {
      setActiveTab('notes')
      setTimeout(() => window.dispatchEvent(new CustomEvent('notes:new_note')), 50)
    }
    window.addEventListener('palette:add_source', onAddSource)
    window.addEventListener('palette:generate', onGenerate)
    window.addEventListener('palette:switch_tab', onSwitchTab)
    window.addEventListener('palette:new_note', onNewNote)
    return () => {
      window.removeEventListener('palette:add_source', onAddSource)
      window.removeEventListener('palette:generate', onGenerate)
      window.removeEventListener('palette:switch_tab', onSwitchTab)
      window.removeEventListener('palette:new_note', onNewNote)
    }
  }, [])

  useShortcut('tab_chat',      useCallback(() => setActiveTab('chat'),     []))
  useShortcut('tab_sources',   useCallback(() => setActiveTab('sources'),  []))
  useShortcut('tab_research',  useCallback(() => setActiveTab('research'), []))
  useShortcut('tab_notes',     useCallback(() => setActiveTab('notes'),    []))
  useShortcut('add_source',    useCallback(() => { setAddSourceType(null); setAddSourceOpen(true) }, []))
  useShortcut('rename',        useCallback(() => { if (!nb) return; setRenameValue(nb.title); setRenaming(true) }, [nb]))
  useShortcut('toggle_canvas', useCallback(() => { if (canvasItem) closeCanvas() }, [canvasItem, closeCanvas]))

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== nb?.title) await renameNotebook(notebookId, trimmed)
    setRenaming(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--color-separator)' }}>
        <button
          onClick={() => setActiveNotebook(null)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="Back to notebooks"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xl">{nb?.emoji ?? '📓'}</span>

        {renaming ? (
          <input
            autoFocus
            className="flex-1 text-base font-semibold bg-transparent outline-none rounded px-1"
            style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)' }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setRenaming(false) }}
          />
        ) : (
          <h1
            className="text-base font-semibold truncate flex-1"
            style={{ color: 'var(--color-text-primary)', cursor: 'default' }}
            onDoubleClick={() => { setRenameValue(nb?.title ?? ''); setRenaming(true) }}
            title="Double-click or press F2 to rename"
          >
            {nb?.title ?? 'Notebook'}
          </h1>
        )}

        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-separator)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: 'var(--color-separator)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: activeTab === tab.id ? 'var(--color-accent-subtle)' : 'transparent',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden relative">
            {TABS.map((tab) => (
              <div
                key={tab.id}
                className="absolute inset-0 h-full"
                style={{ display: activeTab === tab.id ? 'flex' : 'none', flexDirection: 'column' }}
              >
                {tab.id === 'chat'     && <ChatPanel notebookId={notebookId} />}
                {tab.id === 'sources'  && <SourcesPanel notebookId={notebookId} />}
                {tab.id === 'research' && <ResearchPanel notebookId={notebookId} />}
                {tab.id === 'notes'    && <NotesPanel notebookId={notebookId} />}
              </div>
            ))}
          </div>
        </div>
        <CanvasPanel />
      </div>

      <AP>
        {shareOpen && nb && (
          <ShareModal notebookId={notebookId} notebookTitle={nb.title} onClose={() => setShareOpen(false)} />
        )}
      </AP>
      <AP>
        {addSourceOpen && (
          <AddSourceModal
            notebookId={notebookId}
            initialTab={addSourceType ?? undefined}
            onClose={() => { setAddSourceOpen(false); setAddSourceType(null) }}
          />
        )}
      </AP>
      <AP>
        {generateType && (
          <GenerateModal
            artifactType={generateType}
            sources={notebookSources}
            onClose={() => setGenerateType(null)}
            onGenerate={async (config: GenerateConfig) => {
              setGenerateType(null)
              try { await generate(notebookId, config) } catch { /* handled */ }
            }}
          />
        )}
      </AP>
    </div>
  )
}
