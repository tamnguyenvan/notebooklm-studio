'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Maximize2, Download } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useArtifactStore } from '../../stores/artifactStore'
import { ArtifactType } from '../../lib/ipc'
import { AudioViewer } from './viewers/AudioViewer'
import { VideoViewer } from './viewers/VideoViewer'
import { ImageViewer } from './viewers/ImageViewer'
import { PdfViewer } from './viewers/PdfViewer'
import { QuizViewer } from './viewers/QuizViewer'
import { FlashcardViewer } from './viewers/FlashcardViewer'
import { ReportViewer } from './viewers/ReportViewer'
import { DataTableViewer } from './viewers/DataTableViewer'
import { MindMapViewer } from './viewers/MindMapViewer'
import { NoteEditor } from '../notes/NoteEditor'
import { useToastStore } from '../../stores/toastStore'
import { useNotebookStore } from '../../stores/notebookStore'
import { useDownloadStore } from '../../stores/downloadStore'
import { ipc } from '../../lib/ipc'
import { useShortcut } from '../../lib/useShortcut'

const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  audio: 'Audio Overview',
  video: 'Video Overview',
  slides: 'Slide Deck',
  infographic: 'Infographic',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  report: 'Report',
  data_table: 'Data Table',
  mind_map: 'Mind Map',
}

const DOWNLOAD_FORMATS: Record<ArtifactType, { label: string; ext: string; format: string }[]> = {
  audio:       [{ label: 'MP4', ext: 'mp4', format: 'mp4' }],
  video:       [{ label: 'MP4', ext: 'mp4', format: 'mp4' }],
  slides:      [{ label: 'PDF', ext: 'pdf', format: 'pdf' }],
  infographic: [{ label: 'PNG', ext: 'png', format: 'png' }],
  quiz:        [{ label: 'JSON', ext: 'json', format: 'json' }, { label: 'Markdown', ext: 'md', format: 'markdown' }],
  flashcards:  [{ label: 'JSON', ext: 'json', format: 'json' }, { label: 'Markdown', ext: 'md', format: 'markdown' }],
  report:      [{ label: 'Markdown', ext: 'md', format: 'markdown' }],
  data_table:  [{ label: 'CSV', ext: 'csv', format: 'csv' }],
  mind_map:    [{ label: 'JSON', ext: 'json', format: 'json' }],
}

export function CanvasPanel() {
  const { canvasItem, closeCanvas } = useArtifactStore()
  const { show } = useToastStore()
  const { notebooks } = useNotebookStore()
  const { addDownload } = useDownloadStore()
  const [expanded, setExpanded] = useState(false)
  const [showFormats, setShowFormats] = useState(false)

  // Canvas shortcuts — only active when canvas is open
  const dispatchCanvasAction = useCallback((action: string) => {
    window.dispatchEvent(new CustomEvent('canvas:action', { detail: action }))
  }, [])

  useShortcut('canvas_close', useCallback(() => { if (canvasItem) closeCanvas() }, [canvasItem, closeCanvas]))
  useShortcut('canvas_play',  useCallback(() => dispatchCanvasAction('play'),  [dispatchCanvasAction]))
  useShortcut('canvas_back',  useCallback(() => dispatchCanvasAction('back'),  [dispatchCanvasAction]))
  useShortcut('canvas_fwd',   useCallback(() => dispatchCanvasAction('fwd'),   [dispatchCanvasAction]))
  useShortcut('zoom_in',      useCallback(() => dispatchCanvasAction('zoom_in'),    [dispatchCanvasAction]))
  useShortcut('zoom_out',     useCallback(() => dispatchCanvasAction('zoom_out'),   [dispatchCanvasAction]))
  useShortcut('zoom_reset',   useCallback(() => dispatchCanvasAction('zoom_reset'), [dispatchCanvasAction]))

  const handleDownload = async (format: { label: string; ext: string; format: string }) => {
    if (!canvasItem) return
    setShowFormats(false)
    const { notebookId, artifactType } = canvasItem
    const filename = `${ARTIFACT_LABELS[artifactType].replace(/\s+/g, '_')}.${format.ext}`
    try {
      const destPath = await ipc.openSaveDialog(filename, [
        { name: format.label, extensions: [format.ext] },
      ])
      if (!destPath) return
      await ipc.downloadArtifact(notebookId, artifactType, destPath, format.format)

      // Record in library DB
      const notebookTitle = notebooks.find((n) => n.id === notebookId)?.title ?? ''
      try {
        const record = await ipc.recordDownload(notebookId, notebookTitle, artifactType, format.format, destPath)
        addDownload(record)
        show({
          type: 'success',
          message: `Saved ${filename}`,
          undoLabel: 'Show in Finder',
          onUndo: () => ipc.revealDownload(record.id).catch(() => {}),
          duration: 6000,
        })
      } catch {
        // Recording failed — still show success for the download itself
        show({ type: 'success', message: `Saved ${filename}` })
      }
    } catch (e) {
      show({ type: 'error', message: `Download failed: ${String(e)}` })
    }
  }

  return (
    <AnimatePresence>
      {canvasItem && (
        <>
          {/* Backdrop — click to close */}
          <motion.div
            key="canvas-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30"
            style={{ top: 52 }}
            onClick={closeCanvas}
          />

          <motion.div
            key="canvas-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed top-0 right-0 bottom-0 flex flex-col z-40 border-l overflow-hidden"
            style={{
              width: expanded ? 600 : 380,
              background: 'var(--color-content-bg)',
              borderColor: 'var(--color-separator)',
              boxShadow: 'var(--shadow-xl)',
              top: 52,
            }}
          >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--color-separator)' }}
          >
            <span className="flex-1 text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {'type' in canvasItem && canvasItem.type === 'note'
                ? 'Note'
                : ARTIFACT_LABELS[(canvasItem as { notebookId: string; artifactType: ArtifactType }).artifactType]}
            </span>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={closeCanvas}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Viewer */}
          <div className="flex-1 overflow-hidden">
            {'type' in canvasItem && canvasItem.type === 'note' ? (
              <NoteEditor notebookId={canvasItem.notebookId} noteId={canvasItem.noteId} />
            ) : (
              <ViewerSwitch
                notebookId={(canvasItem as { notebookId: string; artifactType: ArtifactType }).notebookId}
                artifactType={(canvasItem as { notebookId: string; artifactType: ArtifactType }).artifactType}
              />
            )}
          </div>

          {/* Footer — only show download for artifacts, not notes */}
          {'type' in canvasItem && canvasItem.type === 'note' ? null : (
            <div
              className="flex items-center justify-between px-3 py-2.5 border-t shrink-0"
              style={{ borderColor: 'var(--color-separator)' }}
            >
              <div className="relative">
                <button
                  onClick={() => {
                    const artifactCanvasItem = canvasItem as { notebookId: string; artifactType: ArtifactType }
                    const formats = DOWNLOAD_FORMATS[artifactCanvasItem.artifactType]
                    if (formats.length === 1) handleDownload(formats[0])
                    else setShowFormats((s) => !s)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={{
                    borderColor: 'var(--color-separator)',
                    color: 'var(--color-text-primary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                  {DOWNLOAD_FORMATS[(canvasItem as { notebookId: string; artifactType: ArtifactType }).artifactType].length > 1 && ' ▾'}
                </button>

                {/* Format picker */}
                <AnimatePresence>
                  {showFormats && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full mb-1 left-0 rounded-lg border overflow-hidden z-50"
                      style={{
                        background: 'var(--color-elevated)',
                        borderColor: 'var(--color-separator)',
                        boxShadow: 'var(--shadow-lg)',
                        minWidth: '120px',
                      }}
                    >
                      {DOWNLOAD_FORMATS[(canvasItem as { notebookId: string; artifactType: ArtifactType }).artifactType].map((fmt) => (
                        <button
                          key={fmt.format}
                          onClick={() => handleDownload(fmt)}
                          className="flex w-full items-center px-3 py-2 text-xs transition-colors"
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function ViewerSwitch({ notebookId, artifactType }: { notebookId: string; artifactType: ArtifactType }) {
  switch (artifactType) {
    case 'audio':
      return <AudioViewer notebookId={notebookId} artifactType={artifactType} />
    case 'video':
      return <VideoViewer notebookId={notebookId} artifactType={artifactType} />
    case 'slides':
      return <PdfViewer notebookId={notebookId} artifactType={artifactType} />
    case 'infographic':
      return <ImageViewer notebookId={notebookId} artifactType={artifactType} />
    case 'quiz':
      return <QuizViewer notebookId={notebookId} />
    case 'flashcards':
      return <FlashcardViewer notebookId={notebookId} />
    case 'report':
      return <ReportViewer notebookId={notebookId} />
    case 'data_table':
      return <DataTableViewer notebookId={notebookId} />
    case 'mind_map':
      return <MindMapViewer notebookId={notebookId} />
    default:
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No viewer for this type</p>
        </div>
      )
  }
}
