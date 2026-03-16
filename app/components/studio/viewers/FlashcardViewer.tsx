'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shuffle, RotateCcw } from 'lucide-react'
import { ipc } from '../../../lib/ipc'

interface Flashcard {
  front: string
  back: string
}

interface Props {
  notebookId: string
}

export function FlashcardViewer({ notebookId }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [ratings, setRatings] = useState<Record<number, 'easy' | 'hard'>>({})

  useEffect(() => {
    setLoading(true)
    ipc.getArtifactData(notebookId, 'flashcards')
      .then((data: unknown) => {
        setCards(parseCards(data))
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [notebookId])

  const card = cards[current]
  const seen = Object.keys(ratings).length

  const navigate = (dir: -1 | 1) => {
    const next = current + dir
    if (next < 0 || next >= cards.length) return
    setCurrent(next)
    setFlipped(false)
  }

  const rate = (r: 'easy' | 'hard') => {
    setRatings((prev) => ({ ...prev, [current]: r }))
    if (current + 1 < cards.length) {
      setCurrent((c) => c + 1)
      setFlipped(false)
    }
  }

  const shuffle = () => {
    setCards((c) => [...c].sort(() => Math.random() - 0.5))
    setCurrent(0)
    setFlipped(false)
    setRatings({})
  }

  const restart = () => {
    setCurrent(0)
    setFlipped(false)
    setRatings({})
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

  if (!card) return null

  const progress = cards.length > 0 ? (seen / cards.length) * 100 : 0

  return (
    <div className="flex flex-col h-full p-5 gap-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {current + 1} / {cards.length}
        </span>
        <div className="flex gap-2">
          <button onClick={shuffle} className="p-1.5 rounded transition-colors" style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Shuffle"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={restart} className="p-1.5 rounded transition-colors" style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Restart"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="w-full h-1 rounded-full" style={{ background: 'var(--color-separator)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--color-accent)' }} />
      </div>

      {/* Card */}
      <div
        className="flex-1 flex items-center justify-center cursor-pointer"
        onClick={() => setFlipped((f) => !f)}
        style={{ perspective: '1000px' }}
      >
        <motion.div
          className="relative w-full h-full"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-xl border"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-separator)',
            }}
          >
            <span className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-tertiary)' }}>Term</span>
            <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
              {card.front}
            </p>
            <span className="text-xs mt-4" style={{ color: 'var(--color-text-tertiary)' }}>Click to flip</span>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-xl border"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'var(--color-accent-subtle)',
              borderColor: 'var(--color-accent)',
            }}
          >
            <span className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--color-accent)' }}>Definition</span>
            <p className="text-sm text-center leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
              {card.back}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Navigation + rating */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          disabled={current === 0}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            color: 'var(--color-text-secondary)',
            opacity: current === 0 ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (current > 0) e.currentTarget.style.background = 'var(--color-app-bg)' }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          ← Prev
        </button>

        {flipped && (
          <div className="flex gap-2">
            <button
              onClick={() => rate('hard')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            >
              2 Hard
            </button>
            <button
              onClick={() => rate('easy')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
            >
              1 Easy
            </button>
          </div>
        )}

        <button
          onClick={() => navigate(1)}
          disabled={current === cards.length - 1}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            color: 'var(--color-text-secondary)',
            opacity: current === cards.length - 1 ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (current < cards.length - 1) e.currentTarget.style.background = 'var(--color-app-bg)' }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

function parseCards(data: unknown): Flashcard[] {
  if (!data) return []
  const arr = Array.isArray(data) ? data : (data as Record<string, unknown>).cards ?? (data as Record<string, unknown>).flashcards ?? []
  if (!Array.isArray(arr)) return []
  return arr.map((c: unknown) => {
    const obj = c as Record<string, unknown>
    return {
      front: String(obj.front ?? obj.f ?? obj.term ?? obj.question ?? ''),
      back: String(obj.back ?? obj.b ?? obj.definition ?? obj.answer ?? ''),
    }
  }).filter((c) => c.front && c.back)
}
