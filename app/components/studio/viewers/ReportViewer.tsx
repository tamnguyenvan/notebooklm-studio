'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check } from 'lucide-react'
import { ipc } from '../../../lib/ipc'

interface TocItem { id: string; text: string; level: number }
interface Props { notebookId: string }

// Flatten React children to plain text reliably
function childrenToText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return childrenToText((children as any).props?.children)
  }
  return ''
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = []
  for (const line of markdown.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+)/)
    if (m) items.push({ id: slugify(m[2].trim()), text: m[2].trim(), level: m[1].length })
  }
  return items
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs transition-colors"
      style={{
        color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy all'}
    </button>
  )
}

export function ReportViewer({ notebookId }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [toc, setToc]         = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

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

  // Highlight active TOC item on scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const headings = Array.from(el.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id]'))
      let current = ''
      for (const h of headings) {
        if (h.offsetTop - el.scrollTop <= 80) current = h.id
      }
      setActiveId(current)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [content])

  const scrollTo = useCallback((id: string) => {
    const container = scrollRef.current
    if (!container) return
    const target = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (!target) return
    // Scroll within the container, not the viewport
    container.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' })
  }, [])

  // Heading component factory — extracts text properly for id + copy
  const makeHeading = (Tag: 'h1' | 'h2' | 'h3', className: string) =>
    // eslint-disable-next-line react/display-name
    ({ children }: { children?: React.ReactNode }) => {
      const text = childrenToText(children)
      const id   = slugify(text)
      return (
        <Tag id={id} className={`group relative ${className}`}
          style={{ color: 'var(--color-text-primary)', scrollMarginTop: 16 }}>
          {children}
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            className="ml-2 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity text-xs"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="Copy heading"
          >
            #
          </button>
        </Tag>
      )
    }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
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
        <div className="w-36 shrink-0 overflow-y-auto p-3 border-r flex flex-col"
          style={{ borderColor: 'var(--color-separator)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-text-tertiary)' }}>Contents</p>
          <div className="flex-1 overflow-y-auto">
            {toc.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="block w-full text-left text-xs py-1 truncate transition-colors rounded px-1"
                style={{
                  paddingLeft: `${4 + (item.level - 1) * 8}px`,
                  color: activeId === item.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: activeId === item.id ? 600 : 400,
                  background: activeId === item.id ? 'var(--color-accent-subtle)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (activeId !== item.id) e.currentTarget.style.color = 'var(--color-text-primary)' }}
                onMouseLeave={(e) => { if (activeId !== item.id) e.currentTarget.style.color = 'var(--color-text-secondary)' }}
              >
                {item.text}
              </button>
            ))}
          </div>
          {/* Copy all */}
          <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--color-separator)' }}>
            <CopyButton text={content ?? ''} />
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: makeHeading('h1', 'text-xl font-bold mt-6 mb-3'),
            h2: makeHeading('h2', 'text-base font-semibold mt-5 mb-2'),
            h3: makeHeading('h3', 'text-sm font-semibold mt-4 mb-1.5'),
            p: ({ children }) => (
              <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-primary)' }}>
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-5 mb-3 space-y-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                {children}
              </li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 pl-4 my-3 italic text-sm"
                style={{ borderColor: 'var(--color-accent)', color: 'var(--color-text-secondary)' }}>
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border-collapse">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="text-left px-3 py-2 text-xs font-semibold border-b"
                style={{ borderColor: 'var(--color-separator)', color: 'var(--color-text-secondary)', background: 'var(--color-app-bg)' }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 text-xs border-b"
                style={{ borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)' }}>
                {children}
              </td>
            ),
            hr: () => <hr className="my-4" style={{ borderColor: 'var(--color-separator)' }} />,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code: ({ children, className, ...props }: any) => {
              const isBlock = !!className?.includes('language-')
              const raw = childrenToText(children)
              if (isBlock) {
                return (
                  <div className="relative group mb-3">
                    <code
                      className="block p-3 rounded-lg text-xs font-mono overflow-x-auto"
                      style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-primary)' }}
                      {...props}
                    >
                      {children}
                    </code>
                    <CopyButton text={raw} />
                  </div>
                )
              }
              return (
                <code className="px-1.5 py-0.5 rounded text-xs font-mono"
                  style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-primary)' }}
                  {...props}>
                  {children}
                </code>
              )
            },
          }}
        >
          {content ?? ''}
        </ReactMarkdown>
      </div>
    </div>
  )
}
