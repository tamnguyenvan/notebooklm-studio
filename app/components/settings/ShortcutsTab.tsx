'use client'

import { useState, useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'
import { useShortcutStore, formatCombo, eventToCombo, ShortcutDef } from '../../stores/shortcutStore'

export function ShortcutsTab() {
  const { shortcuts, reassign, reset } = useShortcutStore()
  const [listening, setListening] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ id: string; conflictId: string; newKey: string } | null>(null)

  // Group shortcuts
  const groups = shortcuts.reduce<Record<string, ShortcutDef[]>>((acc, sc) => {
    if (!acc[sc.group]) acc[sc.group] = []
    acc[sc.group].push(sc)
    return acc
  }, {})

  // Listen for key combo when in listening mode
  useEffect(() => {
    if (!listening) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setListening(null); return }
      // Ignore bare modifier keys
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return
      const combo = eventToCombo(e)
      // Check for conflict
      const existing = shortcuts.find((s) => s.key === combo && s.id !== listening)
      if (existing) {
        setConflict({ id: listening, conflictId: existing.id, newKey: combo })
        setListening(null)
      } else {
        reassign(listening, combo)
        setListening(null)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [listening, shortcuts, reassign])

  const resolveConflict = (keep: boolean) => {
    if (!conflict) return
    if (keep) {
      // reassign the conflicting shortcut to nothing, then assign new
      reassign(conflict.conflictId, '')
      reassign(conflict.id, conflict.newKey)
    }
    setConflict(null)
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Shortcuts
        </h2>
        <button
          onClick={() => reset()}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-separator)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-app-bg)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <RotateCcw size={12} />
          Reset all to defaults
        </button>
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.25)' }}
        >
          <span style={{ color: 'var(--color-text-primary)' }}>
            <span style={{ fontWeight: 600 }}>{formatCombo(conflict.newKey)}</span>
            {' '}is already used by{' '}
            <span style={{ fontWeight: 600 }}>
              {shortcuts.find((s) => s.id === conflict.conflictId)?.label}
            </span>
            . Reassign anyway?
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => resolveConflict(true)}
              className="rounded-md px-3 py-1 text-xs font-semibold"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              Reassign
            </button>
            <button
              onClick={() => resolveConflict(false)}
              className="rounded-md px-3 py-1 text-xs font-medium"
              style={{ border: '1px solid var(--color-separator)', color: 'var(--color-text-secondary)' }}
            >
              Keep old
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <p
              className="mb-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {group}
            </p>
            <div
              className="overflow-hidden rounded-xl"
              style={{ border: '1px solid var(--color-separator)' }}
            >
              {items.map((sc, i) => (
                <ShortcutRow
                  key={sc.id}
                  sc={sc}
                  isLast={i === items.length - 1}
                  isListening={listening === sc.id}
                  onStartListen={() => setListening(sc.id)}
                  onReset={() => reset(sc.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShortcutRow({
  sc, isLast, isListening, onStartListen, onReset,
}: {
  sc: ShortcutDef
  isLast: boolean
  isListening: boolean
  onStartListen: () => void
  onReset: () => void
}) {
  const isModified = sc.key !== sc.defaultKey
  const isEmpty = sc.key === ''

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--color-separator)',
        background: isListening ? 'var(--color-accent-subtle)' : 'transparent',
      }}
    >
      <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
        {sc.label}
      </span>

      <div className="flex items-center gap-2">
        {/* Reset to default button — only when modified */}
        {isModified && (
          <button
            onClick={(e) => { e.stopPropagation(); onReset() }}
            className="rounded p-1 transition-colors"
            title="Reset to default"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
          >
            <RotateCcw size={11} />
          </button>
        )}

        {/* Key badge / listening state */}
        <button
          onClick={onStartListen}
          className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
          style={
            isListening
              ? {
                  background: 'var(--color-accent)',
                  color: '#fff',
                  border: '1.5px solid var(--color-accent)',
                  minWidth: 80,
                }
              : {
                  background: 'var(--color-app-bg)',
                  color: isModified ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  border: `1.5px solid ${isModified ? 'var(--color-accent)' : 'var(--color-separator)'}`,
                  minWidth: 80,
                }
          }
          title="Click to reassign"
        >
          {isListening
            ? 'Press keys…'
            : isEmpty
            ? '—'
            : formatCombo(sc.key)}
        </button>
      </div>
    </div>
  )
}
