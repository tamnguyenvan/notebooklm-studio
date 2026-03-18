'use client'

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Copy, Check, Settings, AlertCircle, ChevronDown, StickyNote, FileText, X, Loader2,
} from 'lucide-react'
import { useChatStore } from '../../stores/chatStore'
import { useToastStore } from '../../stores/toastStore'
import { useSourceStore } from '../../stores/sourceStore'
import { useNotesStore } from '../../stores/notesStore'
import { useArtifactStore } from '../../stores/artifactStore'
import { ChatMessage, ChatReference, ipc } from '../../lib/ipc'
import { useShortcut } from '../../lib/useShortcut'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--color-app-bg);padding:1px 4px;border-radius:4px;font-size:0.85em">$1</code>')
    .replace(/\n/g, '<br/>')
}

// ── Parse answer text into segments (text | citation number) ──────────────────

type Segment = { type: 'text'; value: string } | { type: 'cite'; num: number }

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = []
  const re = /\[(\d+)\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: text.slice(last, m.index) })
    segments.push({ type: 'cite', num: parseInt(m[1]) })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) })
  return segments
}

// ── Citation hover popover ────────────────────────────────────────────────────

function CitationPopover({ anchorRect, title, citedText, onMouseEnter, onMouseLeave }: {
  anchorRect: DOMRect
  title: string
  citedText: string | null
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const popW = el.offsetWidth
    const popH = el.offsetHeight
    const vp = { w: window.innerWidth, h: window.innerHeight }
    const spaceBelow = vp.h - anchorRect.bottom
    const top = spaceBelow < popH + 12
      ? anchorRect.top - popH - 8
      : anchorRect.bottom + 8
    const left = Math.min(Math.max(anchorRect.left - 8, 8), vp.w - popW - 8)
    setPos({ top, left })
  }, [anchorRect])

  return createPortal(
    <motion.div
      ref={ref}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.1 }}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
        width: 280, maxHeight: 260,
        background: 'var(--color-elevated)',
        border: '1px solid var(--color-separator)',
        borderRadius: 12, boxShadow: 'var(--shadow-xl)',
        display: 'flex', flexDirection: 'column',
        cursor: 'default',
      }}
    >
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2 shrink-0"
        style={{ borderBottom: '1px solid var(--color-separator)' }}>
        <FileText style={{ width: 11, height: 11, color: 'var(--color-accent)', flexShrink: 0 }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </span>
      </div>
      <div className="overflow-y-auto px-3 py-2.5" style={{ flex: 1 }}>
        {citedText
          ? <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>"{citedText}"</p>
          : <p className="text-xs italic" style={{ color: 'var(--color-text-tertiary)' }}>No excerpt available</p>
        }
      </div>
    </motion.div>,
    document.body
  )
}

// ── Source fulltext drawer ────────────────────────────────────────────────────

function SourceDrawer({ notebookId, sourceId, title, citedText, onClose }: {
  notebookId: string
  sourceId: string
  title: string
  citedText: string | null
  onClose: () => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const highlightRef = useRef<HTMLElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setLoading(true)
    setError(null)
    ipc.getSourceFulltext(notebookId, sourceId)
      .then((r) => setContent(r.content))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [notebookId, sourceId])

  // After content renders, find and scroll to the cited text
  useEffect(() => {
    if (!content || !citedText || !scrollRef.current) return
    // Give DOM time to paint
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      const highlight = el.querySelector('[data-citation-highlight]') as HTMLElement | null
      if (highlight) {
        highlightRef.current = highlight
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }, [content, citedText])

  // Build HTML with highlight injected
  const buildHtml = (raw: string): string => {
    if (!citedText) return renderMarkdown(raw)
    // Find first occurrence of cited text (case-insensitive)
    const idx = raw.toLowerCase().indexOf(citedText.toLowerCase().slice(0, 60))
    if (idx === -1) return renderMarkdown(raw)
    const before = raw.slice(0, idx)
    const match = raw.slice(idx, idx + citedText.length)
    const after = raw.slice(idx + citedText.length)
    return renderMarkdown(before)
      + `<mark data-citation-highlight style="background:rgba(255,214,0,0.35);border-radius:3px;padding:1px 0">${renderMarkdown(match)}</mark>`
      + renderMarkdown(after)
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 480,
          background: 'var(--color-elevated)',
          borderLeft: '1px solid var(--color-separator)',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--color-separator)' }}>
          <FileText style={{ width: 14, height: 14, color: 'var(--color-accent)', flexShrink: 0 }} />
          <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </span>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Cited excerpt banner */}
        {citedText && (
          <div className="px-4 py-2.5 shrink-0 text-xs leading-relaxed"
            style={{ background: 'rgba(255,214,0,0.12)', borderBottom: '1px solid var(--color-separator)', color: 'var(--color-text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Cited: </span>
            "{citedText}"
          </div>
        )}

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center h-32 gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
              <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
              <span className="text-sm">Loading source…</span>
            </div>
          )}
          {error && (
            <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
          )}
          {content && (
            <div
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: buildHtml(content) }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── Inline citation button ────────────────────────────────────────────────────

function CitationButton({ num, reference, sources, notebookId }: {
  num: number
  reference: ChatReference | undefined
  sources: { id: string; title: string }[]
  notebookId: string
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Track whether mouse is over button OR popover
  const overBtn = useRef(false)
  const overPop = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const src = sources.find((s) => s.id === reference?.source_id)
  const label = src?.title ?? (reference ? `Source ${num}` : `[${num}]`)

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => {
      if (!overBtn.current && !overPop.current) {
        setOpen(false)
        setAnchorRect(null)
      }
    }, 120)
  }
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  const handleBtnEnter = () => {
    if (!reference) return
    overBtn.current = true
    cancelClose()
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect())
    setOpen(true)
  }
  const handleBtnLeave = () => {
    overBtn.current = false
    scheduleClose()
  }
  const handlePopEnter = () => {
    overPop.current = true
    cancelClose()
  }
  const handlePopLeave = () => {
    overPop.current = false
    scheduleClose()
  }
  const handleClick = () => {
    if (!reference) return
    setOpen(false)
    setAnchorRect(null)
    setDrawerOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={handleBtnEnter}
        onMouseLeave={handleBtnLeave}
        onClick={handleClick}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: '50%',
          fontSize: 10, fontWeight: 700, lineHeight: 1,
          background: open ? 'var(--color-accent)' : 'var(--color-accent-subtle)',
          color: open ? '#fff' : 'var(--color-accent)',
          border: '1px solid rgba(0,122,255,0.25)',
          cursor: reference ? 'pointer' : 'default',
          verticalAlign: 'super',
          transition: 'background 0.12s, color 0.12s',
          marginLeft: 1, marginRight: 1,
          flexShrink: 0,
        }}
      >
        {num}
      </button>

      <AnimatePresence>
        {open && anchorRect && reference && (
          <CitationPopover
            anchorRect={anchorRect}
            title={label}
            citedText={reference.cited_text}
            onMouseEnter={handlePopEnter}
            onMouseLeave={handlePopLeave}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawerOpen && reference && (
          <SourceDrawer
            notebookId={notebookId}
            sourceId={reference.source_id}
            title={label}
            citedText={reference.cited_text}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Inline answer renderer (text + citation buttons) ─────────────────────────

function AnswerContent({ content, references, sources, notebookId }: {
  content: string
  references: ChatReference[]
  sources: { id: string; title: string }[]
  notebookId: string
}) {
  const segments = parseSegments(content)
  const refMap = new Map(references.map((r) => [r.citation_number, r]))

  return (
    <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'cite') {
          return (
            <CitationButton
              key={i}
              num={seg.num}
              reference={refMap.get(seg.num)}
              sources={sources}
              notebookId={notebookId}
            />
          )
        }
        // Render markdown text segment
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(seg.value) }}
          />
        )
      })}
    </span>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg, sources, notebookId, onFollowUp, onSaveToNotes,
}: {
  msg: ChatMessage
  sources: { id: string; title: string }[]
  notebookId: string
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm"
          style={{ background: 'var(--color-accent)', color: '#fff' }}>
          {msg.content}
        </div>
      </motion.div>
    )
  }

  if (msg.pending) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>N</div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5" style={{ background: 'var(--color-app-bg)' }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-text-tertiary)' }}
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </motion.div>
    )
  }

  if (msg.error) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,69,58,0.12)', color: 'var(--color-error)' }}>
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
          style={{ background: 'rgba(255,69,58,0.08)', color: 'var(--color-error)' }}>{msg.error}</div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex items-start gap-3 group">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
        style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>N</div>

      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: 'var(--color-app-bg)' }}>
          <AnswerContent
            content={msg.content}
            references={msg.references}
            sources={sources}
            notebookId={notebookId}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={() => onSaveToNotes(msg.content)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <StickyNote className="w-3 h-3" />
            Save to Notes
          </button>
        </div>

        {/* Follow-up chips */}
        {msg.suggested_followups.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 px-1">
            {msg.suggested_followups.map((q, i) => (
              <button key={i} onClick={() => onFollowUp(q)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-separator)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-subtle)'; e.currentTarget.style.color = 'var(--color-accent)'; e.currentTarget.style.borderColor = 'var(--color-accent)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-app-bg)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.borderColor = 'var(--color-separator)' }}>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={spring}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-elevated)', boxShadow: 'var(--shadow-xl)' }}>
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Custom AI instructions</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>Tell the AI how to respond — tone, focus, format, etc.</p>
          <textarea autoFocus className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-separator)', resize: 'none', minHeight: 100 }}
            placeholder="e.g. Always respond in bullet points. Focus on practical applications."
            value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--color-separator)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)', background: 'var(--color-app-bg)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !instructions.trim()} className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: saving || !instructions.trim() ? 'var(--color-text-tertiary)' : 'var(--color-accent)', color: '#fff' }}>
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

  useEffect(() => { loadHistory(notebookId) }, [notebookId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [notebookMessages.length])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

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

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(notebookId, text)
  }, [input, isLoading, notebookId, sendMessage])

  useShortcut('send_message', useCallback(() => handleSend(), [handleSend]))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {!historyReady && (
          <div className="flex flex-col gap-3 px-1 pt-2">
            {[80, 55, 70].map((w, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 1 ? 'justify-end' : ''}`}>
                <div className="rounded-2xl animate-pulse" style={{ width: `${w}%`, height: 48, background: 'var(--color-separator)' }} />
              </div>
            ))}
          </div>
        )}

        {historyReady && notebookMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>N</div>
            <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>Ask anything about your sources</p>
            <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>NotebookLM will answer based on the sources in this notebook.</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {notebookMessages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} sources={notebookSources} notebookId={notebookId}
              onFollowUp={(text) => { setInput(text); textareaRef.current?.focus() }}
              onSaveToNotes={handleSaveToNotes} />
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <AnimatePresence>
        {showScrollBtn && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            transition={spring} onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-24 right-5 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
            style={{ background: 'var(--color-elevated)', color: 'var(--color-text-secondary)', boxShadow: 'var(--shadow-md)' }}>
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: 'var(--color-separator)' }}>
        <div className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)' }}>
          <button onClick={() => setShowPersona(true)} className="p-1.5 rounded-lg flex-shrink-0 mb-0.5 transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
            title="Custom AI instructions">
            <Settings className="w-4 h-4" />
          </button>
          <textarea ref={textareaRef} className="flex-1 bg-transparent text-sm outline-none resize-none py-1"
            style={{ color: 'var(--color-text-primary)', minHeight: 24, maxHeight: 160 }}
            placeholder="Ask anything…" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown} rows={1} />
          <button onClick={handleSend} disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors"
            style={{ background: input.trim() && !isLoading ? 'var(--color-accent)' : 'var(--color-text-tertiary)', color: '#fff' }}>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-center text-xs mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>

      <AnimatePresence>
        {showPersona && <PersonaModal notebookId={notebookId} onClose={() => setShowPersona(false)} />}
      </AnimatePresence>
    </div>
  )
}
