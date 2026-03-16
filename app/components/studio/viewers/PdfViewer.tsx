'use client'

import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ipc, ArtifactType } from '../../../lib/ipc'

// Use CDN worker — avoids needing to copy the worker file to /public
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  notebookId: string
  artifactType: ArtifactType
}

export function PdfViewer({ notebookId, artifactType }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    ipc.getArtifactStreamUrl(notebookId, artifactType)
      .then(setUrl)
      .catch((e) => setError(String(e)))
  }, [notebookId, artifactType])

  if (error) return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-sm text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
    </div>
  )

  if (!url) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* Thumbnail strip */}
      {numPages > 0 && (
        <div
          className="w-20 shrink-0 overflow-y-auto border-r flex flex-col gap-2 p-2"
          style={{ borderColor: 'var(--color-separator)', background: 'var(--color-app-bg)' }}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className="rounded overflow-hidden border-2 transition-colors"
              style={{
                borderColor: p === currentPage ? 'var(--color-accent)' : 'transparent',
              }}
            >
              <Document file={url} loading={null}>
                <Page
                  pageNumber={p}
                  width={64}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </Document>
            </button>
          ))}
        </div>
      )}

      {/* Main view */}
      <div className="flex-1 overflow-auto flex flex-col items-center p-4 gap-3">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            </div>
          }
          error={<p className="text-sm" style={{ color: 'var(--color-error)' }}>Failed to load PDF</p>}
        >
          <Page
            pageNumber={currentPage}
            width={Math.min(500, typeof window !== 'undefined' ? window.innerWidth - 200 : 500)}
            renderAnnotationLayer={false}
          />
        </Document>

        {/* Page nav */}
        {numPages > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded text-xs border transition-colors"
              style={{
                borderColor: 'var(--color-separator)',
                color: 'var(--color-text-secondary)',
                opacity: currentPage === 1 ? 0.4 : 1,
              }}
            >
              ← Prev
            </button>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {currentPage} / {numPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage === numPages}
              className="px-3 py-1.5 rounded text-xs border transition-colors"
              style={{
                borderColor: 'var(--color-separator)',
                color: 'var(--color-text-secondary)',
                opacity: currentPage === numPages ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
