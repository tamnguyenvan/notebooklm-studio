'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Link, Youtube, Upload, HardDrive, AlignLeft } from 'lucide-react'
import { useSourceStore } from '../../stores/sourceStore'
import { useToastStore } from '../../stores/toastStore'
import { ipc } from '../../lib/ipc'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

type Tab = 'url' | 'youtube' | 'file' | 'gdrive' | 'text'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'url',     label: 'URL',          icon: <Link className="w-4 h-4" /> },
  { id: 'youtube', label: 'YouTube',      icon: <Youtube className="w-4 h-4" /> },
  { id: 'file',    label: 'File',         icon: <Upload className="w-4 h-4" /> },
  { id: 'gdrive',  label: 'Google Drive', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'text',    label: 'Text',         icon: <AlignLeft className="w-4 h-4" /> },
]

interface Props {
  notebookId: string
  onClose: () => void
  initialTab?: Tab
}

export function AddSourceModal({ notebookId, onClose, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'url')
  const [url, setUrl] = useState('')
  const [ytUrl, setYtUrl] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { addSource } = useSourceStore()
  const { show: showToast } = useToastStore()

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const submit = async () => {
    setSubmitting(true)
    try {
      let source
      if (tab === 'url') {
        if (!url.trim()) return
        source = await ipc.addSourceUrl(notebookId, url.trim())
      } else if (tab === 'youtube') {
        if (!ytUrl.trim()) return
        source = await ipc.addSourceYoutube(notebookId, ytUrl.trim())
      } else if (tab === 'gdrive') {
        if (!driveUrl.trim()) return
        source = await ipc.addSourceGdrive(notebookId, driveUrl.trim())
      } else if (tab === 'text') {
        if (!textContent.trim()) return
        source = await ipc.addSourceText(notebookId, textTitle.trim() || 'Pasted text', textContent.trim())
      }
      if (source) {
        addSource(source)
        showToast({ message: 'Source added — indexing…', type: 'success' })
        onClose()
      }
    } catch (e) {
      showToast({ message: String(e), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleFilePick = async () => {
    try {
      const selected = await ipc.openFileDialog()
      if (!selected) return
      setSubmitting(true)
      const source = await ipc.addSourceFile(notebookId, selected)
      addSource(source)
      showToast({ message: 'File added — indexing…', type: 'success' })
      onClose()
    } catch (e: unknown) {
      showToast({ message: String(e), type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
  const inputStyle = {
    background: 'var(--color-app-bg)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-separator)',
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
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-elevated)', boxShadow: 'var(--shadow-xl)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Add source
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 px-5 pb-3 border-b"
          style={{ borderColor: 'var(--color-separator)' }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: tab === t.id ? 'var(--color-accent-subtle)' : 'transparent',
                color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {tab === 'url' && (
            <>
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Website URL
              </label>
              <input
                autoFocus
                className={inputCls}
                style={inputStyle}
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              />
            </>
          )}

          {tab === 'youtube' && (
            <>
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                YouTube URL
              </label>
              <input
                autoFocus
                className={inputCls}
                style={inputStyle}
                placeholder="https://youtube.com/watch?v=..."
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              />
            </>
          )}

          {tab === 'file' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Upload className="w-10 h-10" style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
                PDF, TXT, MD, DOCX, MP3, MP4
              </p>
              <button
                onClick={handleFilePick}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                {submitting ? 'Uploading…' : 'Choose file'}
              </button>
            </div>
          )}

          {tab === 'gdrive' && (
            <>
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Google Drive share URL
              </label>
              <input
                autoFocus
                className={inputCls}
                style={inputStyle}
                placeholder="https://docs.google.com/document/d/..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              />
            </>
          )}

          {tab === 'text' && (
            <>
              <input
                autoFocus
                className={inputCls}
                style={inputStyle}
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
              <textarea
                className={inputCls}
                style={{ ...inputStyle, resize: 'none', minHeight: 120 }}
                placeholder="Paste your text here…"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
            </>
          )}
        </div>

        {/* Footer */}
        {tab !== 'file' && (
          <div
            className="flex justify-end gap-2 px-5 py-4 border-t"
            style={{ borderColor: 'var(--color-separator)' }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ color: 'var(--color-text-secondary)', background: 'var(--color-app-bg)' }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: submitting ? 'var(--color-text-tertiary)' : 'var(--color-accent)',
                color: '#fff',
              }}
            >
              {submitting ? 'Adding…' : 'Add source'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
