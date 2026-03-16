'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { ipc } from '../../../lib/ipc'

interface QuizQuestion {
  question: string
  options: string[]
  answer: string | number
  explanation?: string
}

interface Props {
  notebookId: string
}

export function QuizViewer({ notebookId }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setLoading(true)
    ipc.getArtifactData(notebookId, 'quiz')
      .then((data: unknown) => {
        const parsed = parseQuizData(data)
        setQuestions(parsed)
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [notebookId])

  const q = questions[current]

  const submit = () => {
    if (selected === null || !q) return
    setSubmitted(true)
    const correct = isCorrect(q, selected)
    if (correct) setScore((s) => s + 1)
  }

  const next = () => {
    if (current + 1 >= questions.length) {
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setSelected(null)
      setSubmitted(false)
    }
  }

  const restart = () => {
    setCurrent(0)
    setSelected(null)
    setSubmitted(false)
    setScore(0)
    setDone(false)
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

  if (done) return (
    <div className="flex flex-col h-full items-center justify-center gap-4 p-6">
      <div className="text-5xl font-bold" style={{ color: 'var(--color-accent)' }}>
        {score}/{questions.length}
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {score === questions.length ? 'Perfect score!' : score >= questions.length * 0.7 ? 'Great job!' : 'Keep practicing!'}
      </p>
      <button
        onClick={restart}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        <RotateCcw className="w-4 h-4" />
        Restart Quiz
      </button>
    </div>
  )

  if (!q) return null

  const options = q.options ?? []

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-y-auto">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Question {current + 1} of {questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: i < current
                  ? 'var(--color-success)'
                  : i === current
                  ? 'var(--color-accent)'
                  : 'var(--color-separator)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
        {q.question}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const isSelected = selected === i
          const correct = submitted && isCorrect(q, i)
          const wrong = submitted && isSelected && !correct

          return (
            <button
              key={i}
              onClick={() => !submitted && setSelected(i)}
              disabled={submitted}
              className="text-left px-4 py-3 rounded-lg border text-sm transition-all"
              style={{
                borderColor: correct
                  ? 'var(--color-success)'
                  : wrong
                  ? 'var(--color-error)'
                  : isSelected
                  ? 'var(--color-accent)'
                  : 'var(--color-separator)',
                background: correct
                  ? 'rgba(48,209,88,0.12)'
                  : wrong
                  ? 'rgba(255,69,58,0.12)'
                  : isSelected
                  ? 'var(--color-accent-subtle)'
                  : 'transparent',
                color: 'var(--color-text-primary)',
              }}
            >
              <span className="font-medium mr-2" style={{ color: 'var(--color-text-secondary)' }}>
                {String.fromCharCode(65 + i)})
              </span>
              {opt}
              {correct && <CheckCircle2 className="inline w-4 h-4 ml-2" style={{ color: 'var(--color-success)' }} />}
              {wrong && <XCircle className="inline w-4 h-4 ml-2" style={{ color: 'var(--color-error)' }} />}
            </button>
          )
        })}
      </div>

      {/* Explanation */}
      {submitted && q.explanation && (
        <p className="text-xs p-3 rounded-lg" style={{ background: 'var(--color-app-bg)', color: 'var(--color-text-secondary)' }}>
          {q.explanation}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-auto">
        {!submitted ? (
          <button
            onClick={submit}
            disabled={selected === null}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              opacity: selected === null ? 0.4 : 1,
            }}
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={next}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            {current + 1 >= questions.length ? 'See Results' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  )
}

function isCorrect(q: QuizQuestion, selectedIndex: number): boolean {
  const ans = q.answer
  if (typeof ans === 'number') return selectedIndex === ans
  if (typeof ans === 'string') {
    // Could be "A", "B", "C", "D" or the actual text
    const letter = String.fromCharCode(65 + selectedIndex)
    if (ans.toUpperCase() === letter) return true
    return q.options[selectedIndex]?.toLowerCase() === ans.toLowerCase()
  }
  return false
}

function parseQuizData(data: unknown): QuizQuestion[] {
  if (!data) return []
  // Handle array of questions directly
  if (Array.isArray(data)) return data.map(normalizeQuestion).filter(Boolean) as QuizQuestion[]
  // Handle { questions: [...] }
  const d = data as Record<string, unknown>
  if (Array.isArray(d.questions)) return d.questions.map(normalizeQuestion).filter(Boolean) as QuizQuestion[]
  return []
}

function normalizeQuestion(q: unknown): QuizQuestion | null {
  if (!q || typeof q !== 'object') return null
  const obj = q as Record<string, unknown>
  const question = String(obj.question ?? obj.q ?? '')
  const options: string[] = Array.isArray(obj.options)
    ? obj.options.map(String)
    : Array.isArray(obj.choices)
    ? (obj.choices as unknown[]).map(String)
    : []
  const answer = obj.answer ?? obj.correct_answer ?? obj.correct ?? 0
  const explanation = obj.explanation ? String(obj.explanation) : undefined
  if (!question || options.length === 0) return null
  return { question, options, answer: answer as string | number, explanation }
}
