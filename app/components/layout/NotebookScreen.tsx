'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MessageSquare, BookOpen, Wand2, Search, StickyNote, ChevronLeft, Share2 } from 'lucide-react'
import { useNotebookStore } from '../../stores/notebookStore'
import { SourcesPanel } from '../sources/SourcesPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { StudioPanel } from '../studio/StudioPanel'
import { CanvasPanel } from '../studio/CanvasPanel'
import { BackgroundTaskBar } from '../studio/BackgroundTaskBar'
import { ResearchPanel } from '../research/ResearchPanel'
import { NotesPanel } from '../notes/NotesPanel'
import { ShareModal } from '../sharing/ShareModal'
import { ws } from '../../lib/ws'

type TabId = 'chat' | 'sources' | 'studio' | 'research' | 'notes'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'chat',     label: 'Chat',     icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'sources',  label: 'Sources',  icon: <BookOpen className="w-4 h-4" /> },
  { id: 'studio',   label: 'Studio',   icon: <Wand2 className="w-4 h-4" /> },
  { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" /> },
  { id: 'notes',    label: 'Notes',    icon: <StickyNote className="w-4 h-4" /> },
]

interface Props {
  notebookId: string
}

export function NotebookScreen({ notebookId }: Props) {
  const { notebooks, setActiveNotebook } = useNotebookStore()
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const [shareOpen, setShareOpen] = useState(false)
  const nb = notebooks.find((n) => n.id === notebookId)

  // Connect WS once when notebook screen mounts
  useEffect(() => {
    ws.connect(8008)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Notebook header */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b"
        style={{ borderColor: 'var(--color-separator)' }}
      >
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
        <h1
          className="text-base font-semibold truncate flex-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {nb?.title ?? 'Notebook'}
        </h1>
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
      <div
        className="flex items-center gap-1 px-4 py-2 border-b"
        style={{ borderColor: 'var(--color-separator)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative"
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

      {/* Main area: tab content + canvas panel side by side */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tab content — all panels stay mounted; only active one is visible */}
        <div className="flex-1 overflow-hidden relative">
          {TABS.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0 h-full"
              style={{ display: activeTab === tab.id ? 'flex' : 'none', flexDirection: 'column' }}
            >
              {tab.id === 'chat'     && <ChatPanel notebookId={notebookId} />}
              {tab.id === 'sources'  && <SourcesPanel notebookId={notebookId} />}
              {tab.id === 'studio'   && <StudioPanel notebookId={notebookId} />}
              {tab.id === 'research' && <ResearchPanel notebookId={notebookId} />}
              {tab.id === 'notes'    && <NotesPanel notebookId={notebookId} />}
            </div>
          ))}
        </div>

        {/* Canvas panel */}
        <CanvasPanel />
      </div>

      {/* Background task bar */}
      <BackgroundTaskBar />

      {/* Share modal */}
      <AnimatePresence>
        {shareOpen && nb && (
          <ShareModal
            notebookId={notebookId}
            notebookTitle={nb.title}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
