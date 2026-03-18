'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import {
  Search, BookOpen, Settings, Wand2, Plus, StickyNote,
  PanelLeft, Moon, Sun, MessageSquare, Mic, Video,
  Presentation, HelpCircle, CreditCard, Image, FileText,
  Table, GitBranch, Link, Youtube, HardDrive, AlignLeft,
  Library, ArrowRight, Clock,
} from 'lucide-react'
import { useNotebookStore } from '../../stores/notebookStore'
import { useArtifactStore } from '../../stores/artifactStore'
import { ArtifactType } from '../../lib/ipc'

const spring = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const }
const RECENT_KEY = 'palette.recent'
const MAX_RECENT = 5

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaletteCommand {
  id: string
  label: string
  group: string
  icon: React.ReactNode
  keywords?: string[]
  // context: always shown, or only when a notebook is open
  context?: 'always' | 'notebook'
  action: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  // callbacks injected by AppShell
  onNewNotebook: () => void
  onOpenSettings: () => void
  onOpenLibrary: () => void
  onAllNotebooks: () => void
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onAddSource: (type: 'url' | 'youtube' | 'file' | 'text' | 'gdrive') => void
  onGenerate: (type: ArtifactType) => void
  onSwitchTab: (tab: 'chat' | 'sources' | 'studio' | 'research' | 'notes') => void
  onNewNote: () => void
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length
}

function scoreMatch(text: string, query: string): number {
  if (!query) return 0
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  // Exact prefix gets highest score
  if (t.startsWith(q)) return 100
  // Contains gets medium
  if (t.includes(q)) return 50
  // Fuzzy gets low
  return 10
}

// ── Recent commands persistence ───────────────────────────────────────────────

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecent(id: string) {
  const prev = loadRecent().filter((r) => r !== id)
  localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENT)))
}

// ── CommandPalette ────────────────────────────────────────────────────────────

export function CommandPalette({
  open, onClose,
  onNewNotebook, onOpenSettings, onOpenLibrary, onAllNotebooks,
  onToggleSidebar, onToggleTheme,
  onAddSource, onGenerate, onSwitchTab, onNewNote,
}: Props) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { notebooks, activeNotebookId, setActiveNotebook } = useNotebookStore()
  const { openCanvas } = useArtifactStore()

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setRecentIds(loadRecent())
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const execute = useCallback((cmd: PaletteCommand) => {
    saveRecent(cmd.id)
    setRecentIds(loadRecent())
    cmd.action()
    onClose()
  }, [onClose])

  // ── Build command list ────────────────────────────────────────────────────

  const isDark = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-theme') === 'dark'

  const allCommands = useMemo<PaletteCommand[]>(() => [
    // Navigate
    { id: 'nav_notebooks', group: 'Navigate', label: 'Go to All Notebooks', icon: <BookOpen size={15} />, context: 'always', action: () => { onAllNotebooks() } },
    { id: 'nav_library',   group: 'Navigate', label: 'Go to Downloads',     icon: <Library size={15} />,  context: 'always', action: () => { onOpenLibrary() } },
    { id: 'nav_settings',  group: 'Navigate', label: 'Go to Settings',      icon: <Settings size={15} />, context: 'always', action: () => { onOpenSettings() } },

    // Notebooks
    { id: 'nb_new', group: 'Notebooks', label: 'New Notebook', icon: <Plus size={15} />, context: 'always', keywords: ['create', 'add'], action: () => { onNewNotebook() } },
    ...notebooks.map((nb) => ({
      id: `nb_open_${nb.id}`,
      group: 'Notebooks',
      label: `Open "${nb.title}"`,
      icon: <span style={{ fontSize: 14 }}>{nb.emoji ?? '📓'}</span>,
      context: 'always' as const,
      keywords: [nb.title],
      action: () => { setActiveNotebook(nb.id) },
    })),

    // Actions
    { id: 'action_sidebar',  group: 'Actions', label: 'Toggle Sidebar',    icon: <PanelLeft size={15} />, context: 'always', action: () => { onToggleSidebar() } },
    { id: 'action_theme',    group: 'Actions', label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode', icon: isDark ? <Sun size={15} /> : <Moon size={15} />, context: 'always', keywords: ['dark', 'light', 'theme'], action: () => { onToggleTheme() } },

    // Sources (notebook context)
    { id: 'src_url',    group: 'Sources', label: 'Add URL source',          icon: <Link size={15} />,      context: 'notebook', keywords: ['web', 'website', 'link'], action: () => { onAddSource('url') } },
    { id: 'src_yt',     group: 'Sources', label: 'Add YouTube source',      icon: <Youtube size={15} />,   context: 'notebook', keywords: ['video', 'youtube'], action: () => { onAddSource('youtube') } },
    { id: 'src_file',   group: 'Sources', label: 'Add file source',         icon: <FileText size={15} />,  context: 'notebook', keywords: ['pdf', 'upload', 'file'], action: () => { onAddSource('file') } },
    { id: 'src_text',   group: 'Sources', label: 'Add text source',         icon: <AlignLeft size={15} />, context: 'notebook', keywords: ['paste', 'text', 'note'], action: () => { onAddSource('text') } },
    { id: 'src_gdrive', group: 'Sources', label: 'Add Google Drive source', icon: <HardDrive size={15} />, context: 'notebook', keywords: ['drive', 'google'], action: () => { onAddSource('gdrive') } },

    // Generate (notebook context)
    { id: 'gen_audio',      group: 'Generate', label: 'Generate Audio Overview', icon: <Mic size={15} />,          context: 'notebook', keywords: ['podcast', 'audio'], action: () => { onGenerate('audio') } },
    { id: 'gen_video',      group: 'Generate', label: 'Generate Video Summary',  icon: <Video size={15} />,         context: 'notebook', keywords: ['video'], action: () => { onGenerate('video') } },
    { id: 'gen_slides',     group: 'Generate', label: 'Generate Slides',         icon: <Presentation size={15} />,  context: 'notebook', keywords: ['presentation', 'deck'], action: () => { onGenerate('slides') } },
    { id: 'gen_quiz',       group: 'Generate', label: 'Generate Quiz',           icon: <HelpCircle size={15} />,    context: 'notebook', keywords: ['test', 'questions'], action: () => { onGenerate('quiz') } },
    { id: 'gen_flashcards', group: 'Generate', label: 'Generate Flashcards',     icon: <CreditCard size={15} />,    context: 'notebook', keywords: ['study', 'cards'], action: () => { onGenerate('flashcards') } },
    { id: 'gen_infographic',group: 'Generate', label: 'Generate Infographic',    icon: <Image size={15} />,         context: 'notebook', keywords: ['visual', 'image'], action: () => { onGenerate('infographic') } },
    { id: 'gen_report',     group: 'Generate', label: 'Generate Report',         icon: <FileText size={15} />,      context: 'notebook', keywords: ['document', 'write'], action: () => { onGenerate('report') } },
    { id: 'gen_data_table', group: 'Generate', label: 'Generate Data Table',     icon: <Table size={15} />,         context: 'notebook', keywords: ['csv', 'table', 'data'], action: () => { onGenerate('data_table') } },
    { id: 'gen_mind_map',   group: 'Generate', label: 'Generate Mind Map',       icon: <GitBranch size={15} />,     context: 'notebook', keywords: ['map', 'diagram'], action: () => { onGenerate('mind_map') } },

    // Chat (notebook context)
    { id: 'chat_tab',   group: 'Chat',  label: 'Switch to Chat tab',     icon: <MessageSquare size={15} />, context: 'notebook', action: () => { onSwitchTab('chat') } },
    { id: 'chat_persona', group: 'Chat', label: 'Set AI persona',        icon: <Settings size={15} />,      context: 'notebook', keywords: ['instructions', 'persona'], action: () => { onSwitchTab('chat') } },

    // Notes (notebook context)
    { id: 'notes_new', group: 'Notes', label: 'New Note',                icon: <StickyNote size={15} />,    context: 'notebook', keywords: ['create', 'write'], action: () => { onNewNote() } },
    { id: 'notes_tab', group: 'Notes', label: 'Switch to Notes tab',     icon: <StickyNote size={15} />,    context: 'notebook', action: () => { onSwitchTab('notes') } },

    // Research (notebook context)
    { id: 'research_tab', group: 'Research', label: 'Switch to Research tab', icon: <Search size={15} />, context: 'notebook', action: () => { onSwitchTab('research') } },

    // Studio (notebook context)
    { id: 'studio_tab', group: 'Studio', label: 'Switch to Studio tab',  icon: <Wand2 size={15} />,         context: 'notebook', action: () => { onSwitchTab('studio') } },
    { id: 'sources_tab', group: 'Sources', label: 'Switch to Sources tab', icon: <BookOpen size={15} />,    context: 'notebook', action: () => { onSwitchTab('sources') } },
  ], [notebooks, isDark, onAllNotebooks, onOpenLibrary, onOpenSettings, onNewNotebook,
      onToggleSidebar, onToggleTheme, onAddSource, onGenerate, onSwitchTab, onNewNote,
      setActiveNotebook, openCanvas])

  // ── Filter by context + query ─────────────────────────────────────────────

  const contextFiltered = useMemo(() =>
    allCommands.filter((c) => c.context === 'always' || (c.context === 'notebook' && activeNotebookId != null)),
    [allCommands, activeNotebookId]
  )

  // URL detection
  const isUrl = /^https?:\/\//i.test(query.trim())

  const filtered = useMemo(() => {
    if (!query.trim()) return contextFiltered

    return contextFiltered
      .filter((c) => {
        const searchable = [c.label, ...(c.keywords ?? [])].join(' ')
        return fuzzyMatch(searchable, query)
      })
      .sort((a, b) => {
        const sa = scoreMatch(a.label, query)
        const sb = scoreMatch(b.label, query)
        return sb - sa
      })
  }, [contextFiltered, query])

  // Group the filtered results
  const grouped = useMemo(() => {
    const groups: { group: string; items: PaletteCommand[] }[] = []

    // Recent group (only when no query)
    if (!query.trim() && recentIds.length > 0) {
      const recentCmds = recentIds
        .map((id) => contextFiltered.find((c) => c.id === id))
        .filter(Boolean) as PaletteCommand[]
      if (recentCmds.length > 0) groups.push({ group: 'Recent', items: recentCmds })
    }

    // URL shortcut
    if (isUrl && activeNotebookId) {
      const nb = notebooks.find((n) => n.id === activeNotebookId)
      groups.push({
        group: 'Quick Add',
        items: [{
          id: 'quick_url',
          group: 'Quick Add',
          label: `Add "${query.trim()}" as source`,
          icon: <Link size={15} />,
          context: 'notebook',
          action: () => { onAddSource('url') },
        }],
      })
    }

    // Regular groups
    const groupOrder = ['Navigate', 'Notebooks', 'Actions', 'Sources', 'Generate', 'Chat', 'Notes', 'Research', 'Studio']
    const byGroup: Record<string, PaletteCommand[]> = {}
    for (const cmd of filtered) {
      if (!byGroup[cmd.group]) byGroup[cmd.group] = []
      byGroup[cmd.group].push(cmd)
    }
    for (const g of groupOrder) {
      if (byGroup[g]?.length) groups.push({ group: g, items: byGroup[g] })
    }

    return groups
  }, [filtered, query, recentIds, contextFiltered, isUrl, activeNotebookId, notebooks, onAddSource])

  // Flat list for keyboard nav
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  // Keep selectedIdx in bounds
  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = flatItems[selectedIdx]
      if (cmd) execute(cmd)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [flatItems, selectedIdx, execute, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AP>
      {open && (
        <motion.div
          key="palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[28vh]"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            key="palette-panel"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={spring}
            className="flex flex-col overflow-hidden"
            style={{
              width: 640,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: '60vh',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-elevated)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--color-separator)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div
              className="flex items-center gap-3 px-4"
              style={{
                borderBottom: '1px solid var(--color-separator)',
                height: 52,
                flexShrink: 0,
              }}
            >
              <Search size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--color-text-primary)' }}
                placeholder="Search commands, notebooks…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--color-app-bg)',
                  color: 'var(--color-text-tertiary)',
                  border: '1px solid var(--color-separator)',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto flex-1 py-1.5">
              {grouped.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Search size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    No results for "{query}"
                  </p>
                </div>
              )}

              {grouped.map(({ group, items }) => {
                const groupStartIdx = flatItems.indexOf(items[0])
                return (
                  <div key={group} className="mb-1">
                    <div
                      className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {group === 'Recent' ? (
                        <span className="flex items-center gap-1.5">
                          <Clock size={10} />
                          Recent
                        </span>
                      ) : group}
                    </div>
                    {items.map((cmd, i) => {
                      const idx = groupStartIdx + i
                      const isSelected = idx === selectedIdx
                      return (
                        <button
                          key={cmd.id}
                          data-idx={idx}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-left transition-colors"
                          style={{
                            background: isSelected ? 'var(--color-accent-subtle)' : 'transparent',
                            color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                          }}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          onClick={() => execute(cmd)}
                        >
                          <span
                            className="flex-shrink-0"
                            style={{ color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
                          >
                            {cmd.icon}
                          </span>
                          <span className="flex-1 truncate">{cmd.label}</span>
                          {isSelected && (
                            <ArrowRight size={13} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Footer hint */}
            <div
              className="flex items-center gap-4 px-4 py-2 text-xs"
              style={{
                borderTop: '1px solid var(--color-separator)',
                color: 'var(--color-text-tertiary)',
                flexShrink: 0,
              }}
            >
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded" style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)' }}>↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded" style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)' }}>↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 rounded" style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)' }}>Esc</kbd>
                close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AP>,
    document.body
  )
}
