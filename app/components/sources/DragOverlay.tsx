'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload } from 'lucide-react'
import { useSourceStore } from '../../stores/sourceStore'
import { useToastStore } from '../../stores/toastStore'
import { ipc } from '../../lib/ipc'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

const SUPPORTED_EXTS = ['pdf', 'txt', 'md', 'docx', 'mp3', 'mp4']

interface Props {
  notebookId: string | null
}

export function DragOverlay({ notebookId }: Props) {
  const [active, setActive] = useState(false)
  const [depth, setDepth] = useState(0)
  const { addSource } = useSourceStore()
  const { show: showToast } = useToastStore()

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDepth((d) => d + 1)
    setActive(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDepth((d) => {
      const next = d - 1
      if (next <= 0) setActive(false)
      return next
    })
  }, [])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      setActive(false)
      setDepth(0)

      if (!notebookId) {
        showToast({ message: 'Open a notebook first', type: 'error' })
        return
      }

      const items = Array.from(e.dataTransfer?.items ?? [])
      const files = Array.from(e.dataTransfer?.files ?? [])

      // Handle URL drops
      const urlData = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain')
      if (files.length === 0 && urlData?.startsWith('http')) {
        try {
          const source = await ipc.addSourceUrl(notebookId, urlData.trim())
          addSource(source)
          showToast({ message: 'URL added — indexing…', type: 'success' })
        } catch (err) {
          showToast({ message: String(err), type: 'error' })
        }
        return
      }

      // Handle file drops
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
        if (!SUPPORTED_EXTS.includes(ext)) {
          showToast({ message: `Unsupported file type: .${ext}`, type: 'error' })
          continue
        }
        // Tauri file drop gives us the path via the file object's path property
        const filePath = (file as unknown as { path?: string }).path
        if (!filePath) {
          showToast({ message: 'Could not get file path', type: 'error' })
          continue
        }
        try {
          const source = await ipc.addSourceFile(notebookId, filePath)
          addSource(source)
          showToast({ message: `${file.name} added — indexing…`, type: 'success' })
        } catch (err) {
          showToast({ message: String(err), type: 'error' })
        }
      }
    },
    [notebookId, addSource, showToast]
  )

  useEffect(() => {
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onDragEnter, onDragLeave, onDragOver, onDrop])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={spring}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 pointer-events-none"
          style={{ background: 'rgba(0,122,255,0.12)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={spring}
            className="flex flex-col items-center gap-3 rounded-2xl px-10 py-8"
            style={{
              background: 'var(--color-elevated)',
              boxShadow: 'var(--shadow-xl)',
              border: '2px dashed var(--color-accent)',
            }}
          >
            <Upload className="w-10 h-10" style={{ color: 'var(--color-accent)' }} />
            <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Drop to add source
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              PDF, TXT, MD, DOCX, MP3, MP4 or a URL
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
