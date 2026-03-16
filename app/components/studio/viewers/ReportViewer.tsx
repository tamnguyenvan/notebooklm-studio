'use client'

import { useEffect, useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ipc } from '../../../lib/ipc'

interface TocItem {
  id: string
  text: string
  level: number
}

interface Props {
  notebookId: string
}

export function ReportViewer({ notebookId }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    ipc.getArtifactData(notebookId, 'report')
      .then((data: unknown) => {
        const d = data as Record<string, unknown>
        const text = String(d?.content ?? data ?? '')
        setContent(text)
        setToc(extractToc(text))
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [notebookId])

  const scrollTo = (id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-sm text-center" style={{ color: 'var(--color-error)' }}>{error}</p>
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* TOC sidebar */}
      {toc.length > 0 && (
        <div
          className="w-36 shrink-0 overflow-y-auto p-3 border-r"
          style={{ borderColor: 'var(--color-separator)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Contents
          </p>
          {toc.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="block w-full text-left text-xs py-1 truncate transition-colors"
              style={{
                paddingLeft: `${(item.level - 1) * 8}px`,
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            >
              {item.text}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-5">
        <div
          className="prose prose-sm max-w-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children, ...props }) => {
                const id = slugify(String(children))
                return <h1 id={id} className="text-xl font-bold mt-6 mb-3" style={{ color: 'var(--color-text-primary)' }} {...props}>{children}</h1>
              },
              h2: ({ children, ...props }) => {
                const id = slugify(String(children))
                return <h2 id={id} className="text-base font-semibold mt-5 mb-2" style={{ color: 'var(--color-text-primary)' }} {...props}>{children}</h2>
              },
              h3: ({ children, ...props }) => {
                const id = slugify(String(children))
                return <h3 id={id} className="text-sm font-semibold mt-4 mb-1.5" style={{ color: 'var(--color-text-primary)' }} {...props}>{children}</h3>
              },
              p: ({ children }) => <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-primary)' }}>{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{children}</ol>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 pl-4 my-3 italic text-sm" style={{ borderColor: 'var(--color-accent)', color: 'var(--color-text-secondary)' }}>
                  {children}
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                return isBlock
                  ? <code className="block p-3 rounded-lg text-xs font-mono overflow-x-auto mb-3" style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-primary)' }}>{children}</code>
                  : <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-primary)' }}>{children}</code>
              },
            }}
          >
            {content ?? ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n')
  const items: TocItem[] = []
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      items.push({ id: slugify(text), text, level })
    }
  }
  return items
}
