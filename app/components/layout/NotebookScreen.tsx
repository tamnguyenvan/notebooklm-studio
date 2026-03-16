'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, BookOpen, Wand2, Search, StickyNote, ChevronLeft } from 'lucide-react'
import { useNotebookStore } from '../../stores/notebookStore'
import { SourcesPanel } from '../sources/SourcesPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { StudioPanel } from '../studio/StudioPanel'
import { CanvasPanel } from '../studio/CanvasPanel'
import { BackgroundTaskBar } from '../studio/BackgroundTaskBar'
import { ws } from '../../lib/ws'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

type TabId = 'chat' | 'sources' | 'studio' | 'research' | 'notes'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'chat',     label: 'Chat',     icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'sources',  label: 'Sources',  icon: <BookOpen className="w-4 h-4" /> },
  { id: 'studio',   label: 'Studio',   icon: <Wand2 className="w-4 h-4" /> },
  { id: 'research', label: 'Research', icon: <Search className="w-4 h-4" /> },
  { id: 'notes',    label: 'Notes',    icon: <StickyNote className="w-4 h-4" /> },
]

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        {label} — coming soon
      </p>
    </div>
  )
}

interface Props {
  notebookId: string
}

export function NotebookScreen({ notebookId }: Props) {
  const { notebooks, setActiveNotebook } = useNotebookStore()
  const [activeTab, setActiveTab] = useState<TabId>('chat')
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
          className="text-base font-semibold truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {nb?.title ?? 'Notebook'}
        </h1>
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
        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={spring}
              className="h-full"
            >
              {activeTab === 'chat'     && <ChatPanel notebookId={notebookId} />}
              {activeTab === 'sources'  && <SourcesPanel notebookId={notebookId} />}
              {activeTab === 'studio'   && <StudioPanel notebookId={notebookId} />}
              {activeTab === 'research' && <PlaceholderTab label="Research" />}
              {activeTab === 'notes'    && <PlaceholderTab label="Notes" />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Canvas panel */}
        <CanvasPanel />
      </div>

      {/* Background task bar */}
      <BackgroundTaskBar />
    </div>
  )
}
