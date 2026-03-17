'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Copy, Check, Settings, AlertCircle, BookOpen, ChevronDown, StickyNote,
} from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useToastStore } from '../../stores/toastStore'
import { useSourceStore } from '../../stores/sourceStore'
import { useNotesStore } from '../../stores/notesStore'
import { useArtifactStore } from '../../stores/artifactStore'
import { ChatMessage, ChatReference } from '../../lib/ipc'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

// ── Markdown renderer (no external dep — simple inline parser) ────────────────

function renderMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:var(--color-app-bg);padding:1px 4px;border-radius:4px;font-size:0.85em">$1</code>')
    // Newlines
    .replace(/\n/g, '<br/>')
}

// ── Citation chip ─────────────────────────────────────────────────────────────

function CitationChip({ ref: r, sources }: { ref: ChatReference; sources: { id: string; title: string }[] }) {
  const src = sources.find((s) => s.id === r.source_id)
  const label = src?.title ?? `Source ${r.citation_number ?? '?'}`
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-default"
      style={{
        background: 'var(--color-accent-subtle)',
        color: 'var(--color-accent)',
        border: '1px solid rgba(0,122,255,0.2)',
      }}
      title={r.cited_text ?? label}
    >
      <BookOpen className="w-3 h-3" />
      {r.citation_number != null ? `[${r.citation_number}] ` : ''}{label.length > 28 ? label.slice(0, 28) + '…' : label}
    </span>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  sources,
  onFollowUp,
  onSaveToNotes,
}: {
  msg: ChatMessage
  sources: { id: string; title: string }[]
  onFollowUp: (text: string) => void
  onSaveToNotes: (content: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [msg.content])

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex justify-end"
      >
        <div
          className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {msg.content}
        </div>
      </motion.div>
    )
  }

  // Pending (loading) bubble
  if (msg.pending) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex items-start gap-3"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
        >
          N
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5"
          style={{ background: 'var(--color-app-bg)' }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--color-text-tertiary)' }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    )
  }

  // Error bubble
  if (msg.error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="flex items-start gap-3"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,69,58,0.12)', color: 'var(--color-error)' }}
        >
          <AlertCircle className="w-4 h-4" />
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
          style={{ background: 'rgba(255,69,58,0.08)', color: 'var(--color-error)' }}
        >
          {msg.error}
        </div>
      </motion.div>
    )
  }

  // Assistant bubble
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex items-start gap-3 group"
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
        style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
      >
        N
      </div>

      <div className="flex-1 min-w-0">
        {/* Answer text */}
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
          style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-primary)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />

        {/* Citations */}
        {msg.references.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 px-1">
            {msg.references.map((r, i) => (
              <CitationChip key={i} ref={r} sources={sources} />
            ))}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-1 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => onSaveToNotes(msg.content)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <StickyNote className="w-3 h-3" />
            Save to Notes
          </button>
        </div>

        {/* Follow-up chips */}
        {msg.suggested_followups.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 px-1">
            {msg.suggested_followups.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(q)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: 'var(--color-app-bg)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-separator)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent-subtle)'
                  e.currentTarget.style.color = 'var(--color-accent)'
                  e.currentTarget.style.borderColor = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-app-bg)'
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                  e.currentTarget.style.borderColor = 'var(--color-separator)'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Persona modal ─────────────────────────────────────────────────────────────

function PersonaModal({ notebookId, onClose }: { notebookId: string; onClose: () => void }) {
  const [instructions, setInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const { setPersona } = useChatStore()
  const { show: showToast } = useToastStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    if (!instructions.trim()) return
    setSaving(true)
    try {
      await setPersona(notebookId, instructions.trim())
      showToast({ message: 'Persona updated', type: 'success' })
      onClose()
    } catch (e) {
      showToast({ message: String(e), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={spring}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-elevated)', boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Custom AI instructions
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Tell the AI how to respond — tone, focus, format, etc.
          </p>
          <textarea
            autoFocus
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--color-app-bg)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-separator)',
              resize: 'none',
              minHeight: 100,
            }}
            placeholder="e.g. Always respond in bullet points. Focus on practical applications."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <div
          className="flex justify-end gap-2 px-5 py-4 border-t"
          style={{ borderColor: 'var(--color-separator)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)', background: 'var(--color-app-bg)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !instructions.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: saving || !instructions.trim() ? 'var(--color-text-tertiary)' : 'var(--color-accent)',
              color: '#fff',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main ChatPanel ────────────────────────────────────────────────────────────

export function ChatPanel({ notebookId }: { notebookId: string }) {
  const { messages, loading, historyLoaded, loadHistory, sendMessage } = useChatStore()
  const { sources } = useSourceStore()
  const { prefillNote } = useNotesStore()
  const { openNote } = useArtifactStore()
  const { show: showToast } = useToastStore()
  const [input, setInput] = useState('')
  const [showPersona, setShowPersona] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const notebookMessages = messages[notebookId] ?? []
  const isLoading = loading[notebookId] ?? false
  const historyReady = historyLoaded[notebookId] ?? false
  const notebookSources = (sources[notebookId] ?? []).map((s) => ({ id: s.id, title: s.title }))

  // Load history on mount
  useEffect(() => {
    loadHistory(notebookId)
  }, [notebookId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notebookMessages.length])

  // Track scroll position for scroll-to-bottom button
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distFromBottom > 120)
  }

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  const handleSaveToNotes = useCallback(async (content: string) => {
    try {
      const note = await prefillNote(notebookId, content)
      openNote(notebookId, note.id)
      showToast({ type: 'success', message: 'Saved to Notes' })
    } catch (e) {
      showToast({ type: 'error', message: `Failed to save: ${String(e)}` })
    }
  }, [notebookId, prefillNote, openNote, showToast])

  const handleSend = useCallback(async () => {    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(notebookId, text)
  }, [input, isLoading, notebookId, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = notebookMessages.length === 0

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      >
        {!historyReady && (
          <div className="flex flex-col gap-3 px-1 pt-2">
            {[80, 55, 70].map((w, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 1 ? 'justify-end' : ''}`}>
                <div
                  className="rounded-2xl animate-pulse"
                  style={{
                    width: `${w}%`,
                    height: 48,
                    background: 'var(--color-separator)',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {historyReady && isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
            >
              N
            </div>
            <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Ask anything about your sources
            </p>
            <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
              NotebookLM will answer based on the sources in this notebook.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {notebookMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              sources={notebookSources}
              onFollowUp={(text) => {
                setInput(text)
                textareaRef.current?.focus()
              }}
              onSaveToNotes={handleSaveToNotes}
            />
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={spring}
            onClick={scrollToBottom}
            className="absolute bottom-24 right-5 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
            style={{ background: 'var(--color-elevated)', color: 'var(--color-text-secondary)', boxShadow: 'var(--shadow-md)' }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div
        className="px-4 pb-4 pt-2 border-t"
        style={{ borderColor: 'var(--color-separator)' }}
      >
        <div
          className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{
            background: 'var(--color-app-bg)',
            border: '1px solid var(--color-separator)',
          }}
        >
          {/* Persona button */}
          <button
            onClick={() => setShowPersona(true)}
            className="p-1.5 rounded-lg flex-shrink-0 mb-0.5 transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
            title="Custom AI instructions"
          >
            <Settings className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent text-sm outline-none resize-none py-1"
            style={{
              color: 'var(--color-text-primary)',
              minHeight: 24,
              maxHeight: 160,
            }}
            placeholder="Ask anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors"
            style={{
              background: input.trim() && !isLoading ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              color: '#fff',
            }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-center text-xs mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>

      {/* Persona modal */}
      <AnimatePresence>
        {showPersona && (
          <PersonaModal notebookId={notebookId} onClose={() => setShowPersona(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
