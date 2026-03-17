'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Shuffle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { ipc } from '../../../lib/ipc'

interface Flashcard { front: string; back: string }
interface Props { notebookId: string }

// Solid palettes — vivid bg, white text
const PALETTES = [
  { bg: '#3B6FE8', shadow: 'rgba(59,111,232,0.35)'  }, // blue
  { bg: '#16A34A', shadow: 'rgba(22,163,74,0.35)'   }, // green
  { bg: '#EA580C', shadow: 'rgba(234,88,12,0.35)'   }, // orange
  { bg: '#9333EA', shadow: 'rgba(147,51,234,0.35)'  }, // purple
] as const

export function FlashcardViewer({ notebookId }: Props) {
  const [cards, setCards]     = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [offset, setOffset]   = useState(0) // px translation during nav
  const [ratings, setRatings] = useState<Record<number, 'easy' | 'hard'>>({})
  const animating = useRef(false)

  useEffect(() => {
    setLoading(true)
    ipc.getArtifactData(notebookId, 'flashcards')
      .then((data: unknown) => { setCards(parseCards(data)); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [notebookId])

  const navigate = useCallback((d: -1 | 1) => {
    const next = current + d
    if (next < 0 || next >= cards.length || animating.current) return
    animating.current = true
    // Slide out
    setOffset(d * -100)
    setTimeout(() => {
      setCurrent(next)
      setFlipped(false)
      // Snap to incoming side, then slide to center
      setOffset(d * 100)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOffset(0)
          setTimeout(() => { animating.current = false }, 220)
        })
      })
    }, 180)
  }, [current, cards.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  navigate(-1)
      if (e.key === 'ArrowRight') navigate(1)
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFlipped(f => !f)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const rate = (r: 'easy' | 'hard') => {
    setRatings(prev => ({ ...prev, [current]: r }))
    if (current + 1 < cards.length) navigate(1)
  }

  const shuffle = () => {
    setCards(c => [...c].sort(() => Math.random() - 0.5))
    setCurrent(0); setFlipped(false); setRatings({})
  }

  const restart = () => { setCurrent(0); setFlipped(false); setRatings({}) }

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
  if (!cards.length) return null

  const card     = cards[current]
  const seen     = Object.keys(ratings).length
  const progress = cards.length > 0 ? (seen / cards.length) * 100 : 0
  const palette  = PALETTES[current % 4]

  return (
    <div className="flex flex-col h-full p-5 gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
          {current + 1} / {cards.length}
        </span>
        <div className="flex gap-1">
          <button onClick={shuffle} className="p-1.5 rounded transition-colors" title="Shuffle"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={restart} className="p-1.5 rounded transition-colors" title="Restart"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full h-1 rounded-full" style={{ background: 'var(--color-separator)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%`, background: 'var(--color-accent)' }} />
      </div>

      {/* Card */}
      <div className="flex-1 overflow-hidden" style={{ perspective: '1200px' }}>
        {/* Slide wrapper — no remount, just translate */}
        <div
          className="w-full h-full"
          style={{
            transform: `translateX(${offset}%)`,
            transition: offset === 0 ? 'transform 200ms cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
          }}
        >
          {/* Flip wrapper */}
          <motion.div
            className="w-full h-full"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
            onClick={() => setFlipped(f => !f)}
          >
            {/* Front */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl select-none"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                background: palette.bg,
                boxShadow: `0 8px 32px ${palette.shadow}, 0 2px 8px rgba(0,0,0,0.12)`,
              }}
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold mb-4"
                style={{ color: 'rgba(255,255,255,0.6)' }}>Term</span>
              <p className="text-lg font-bold text-center leading-snug" style={{ color: '#fff' }}>
                {card.front}
              </p>
              <span className="text-[10px] mt-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
                click or space to flip
              </span>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl select-none"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: palette.bg,
                boxShadow: `0 8px 32px ${palette.shadow}, 0 2px 8px rgba(0,0,0,0.12)`,
                filter: 'brightness(0.88)',
              }}
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold mb-4"
                style={{ color: 'rgba(255,255,255,0.6)' }}>Definition</span>
              <p className="text-sm text-center leading-relaxed" style={{ color: '#fff' }}>
                {card.back}
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Navigation + rating */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          disabled={current === 0}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)', opacity: current === 0 ? 0.3 : 1 }}
          onMouseEnter={(e) => { if (current > 0) e.currentTarget.style.background = 'var(--color-app-bg)' }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {flipped ? (
          <div className="flex gap-2">
            <button onClick={() => rate('hard')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(255,69,58,0.08)', color: 'var(--color-error)', border: '1px solid rgba(255,69,58,0.2)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,69,58,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,69,58,0.08)')}>
              Hard
            </button>
            <button onClick={() => rate('easy')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(48,209,88,0.08)', color: 'var(--color-success)', border: '1px solid rgba(48,209,88,0.2)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(48,209,88,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(48,209,88,0.08)')}>
              Easy
            </button>
          </div>
        ) : (
          <div className="flex gap-1.5 items-center">
            {cards.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-200"
                style={{
                  width:  i === current ? 16 : 6,
                  height: 6,
                  background: i === current ? 'var(--color-accent)' : 'var(--color-separator)',
                }} />
            ))}
          </div>
        )}

        <button
          onClick={() => navigate(1)}
          disabled={current === cards.length - 1}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-secondary)', opacity: current === cards.length - 1 ? 0.3 : 1 }}
          onMouseEnter={(e) => { if (current < cards.length - 1) e.currentTarget.style.background = 'var(--color-app-bg)' }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function parseCards(data: unknown): Flashcard[] {
  if (!data) return []
  const arr = Array.isArray(data) ? data
    : (data as Record<string, unknown>).cards
    ?? (data as Record<string, unknown>).flashcards
    ?? []
  if (!Array.isArray(arr)) return []
  return arr.map((c: unknown) => {
    const o = c as Record<string, unknown>
    return {
      front: String(o.front ?? o.f ?? o.term ?? o.question ?? ''),
      back:  String(o.back  ?? o.b ?? o.definition ?? o.answer ?? ''),
    }
  }).filter(c => c.front && c.back)
}
