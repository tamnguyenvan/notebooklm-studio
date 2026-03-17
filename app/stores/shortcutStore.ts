import { create } from 'zustand'

// ── Platform detection ────────────────────────────────────────────────────────
const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShortcutDef {
  id: string
  label: string
  group: string
  defaultKey: string
  // runtime key (may be reassigned)
  key: string
}

export type ShortcutHandler = () => void

// ── Default shortcut definitions ──────────────────────────────────────────────

const DEFAULTS: Omit<ShortcutDef, 'key'>[] = [
  // Global
  { id: 'palette',        group: 'Global',         label: 'Open command palette',  defaultKey: 'Meta+k' },
  { id: 'new_notebook',   group: 'Global',         label: 'New notebook',          defaultKey: 'Meta+n' },
  { id: 'settings',       group: 'Global',         label: 'Open settings',         defaultKey: 'Meta+,' },
  { id: 'toggle_sidebar', group: 'Global',         label: 'Toggle sidebar',        defaultKey: 'Meta+b' },
  { id: 'toggle_canvas',  group: 'Global',         label: 'Toggle canvas panel',   defaultKey: 'Meta+Shift+p' },
  { id: 'toggle_theme',   group: 'Global',         label: 'Toggle dark mode',      defaultKey: 'Meta+Shift+d' },
  { id: 'add_source',     group: 'Global',         label: 'Add source',            defaultKey: 'Meta+Shift+s' },
  { id: 'rename',         group: 'Global',         label: 'Rename notebook',       defaultKey: 'F2' },
  // Tabs
  { id: 'tab_chat',       group: 'Tabs',           label: 'Switch to Chat',        defaultKey: 'Meta+1' },
  { id: 'tab_sources',    group: 'Tabs',           label: 'Switch to Sources',     defaultKey: 'Meta+2' },
  { id: 'tab_studio',     group: 'Tabs',           label: 'Switch to Studio',      defaultKey: 'Meta+3' },
  { id: 'tab_research',   group: 'Tabs',           label: 'Switch to Research',    defaultKey: 'Meta+4' },
  { id: 'tab_notes',      group: 'Tabs',           label: 'Switch to Notes',       defaultKey: 'Meta+5' },
  // Chat
  { id: 'send_message',   group: 'Chat',           label: 'Send message',          defaultKey: 'Meta+Enter' },
  // Canvas
  { id: 'canvas_play',    group: 'Canvas Viewers', label: 'Play / pause',          defaultKey: 'Space' },
  { id: 'canvas_back',    group: 'Canvas Viewers', label: 'Seek / prev',           defaultKey: 'ArrowLeft' },
  { id: 'canvas_fwd',     group: 'Canvas Viewers', label: 'Seek / next',           defaultKey: 'ArrowRight' },
  { id: 'canvas_close',   group: 'Canvas Viewers', label: 'Close canvas',          defaultKey: 'Escape' },
  { id: 'zoom_in',        group: 'Canvas Viewers', label: 'Zoom in',               defaultKey: 'Meta+=' },
  { id: 'zoom_out',       group: 'Canvas Viewers', label: 'Zoom out',              defaultKey: 'Meta+-' },
  { id: 'zoom_reset',     group: 'Canvas Viewers', label: 'Reset zoom',            defaultKey: 'Meta+0' },
]

const STORAGE_KEY = 'shortcuts.overrides'

function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function buildDefs(overrides: Record<string, string>): ShortcutDef[] {
  return DEFAULTS.map((d) => ({ ...d, key: overrides[d.id] ?? d.defaultKey }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise a KeyboardEvent into a canonical combo string, e.g. "Meta+Shift+k" */
export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('Meta')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key === ' ' ? 'Space' : e.key
  if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) parts.push(key)
  return parts.join('+')
}

/** Format a combo string for display.
 *  macOS:         "Meta+Shift+k" → "⌘⇧K"
 *  Linux/Windows: "Meta+Shift+k" → "Ctrl+Shift+K"
 */
export function formatCombo(combo: string): string {
  if (IS_MAC) {
    return combo
      .split('+')
      .map((p) => {
        switch (p) {
          case 'Meta':       return '⌘'
          case 'Alt':        return '⌥'
          case 'Shift':      return '⇧'
          case 'Space':      return 'Space'
          case 'Escape':     return 'Esc'
          case 'ArrowLeft':  return '←'
          case 'ArrowRight': return '→'
          case 'ArrowUp':    return '↑'
          case 'ArrowDown':  return '↓'
          case 'Enter':      return '↵'
          default:           return p.length === 1 ? p.toUpperCase() : p
        }
      })
      .join('')
  }

  // Linux / Windows — use readable text tokens joined by "+"
  return combo
    .split('+')
    .map((p) => {
      switch (p) {
        case 'Meta':       return 'Ctrl'
        case 'Alt':        return 'Alt'
        case 'Shift':      return 'Shift'
        case 'Space':      return 'Space'
        case 'Escape':     return 'Esc'
        case 'ArrowLeft':  return '←'
        case 'ArrowRight': return '→'
        case 'ArrowUp':    return '↑'
        case 'ArrowDown':  return '↓'
        case 'Enter':      return 'Enter'
        default:           return p.length === 1 ? p.toUpperCase() : p
      }
    })
    .join('+')
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ShortcutStore {
  shortcuts: ShortcutDef[]
  // registered action handlers (set by components)
  _handlers: Map<string, ShortcutHandler>

  register: (id: string, handler: ShortcutHandler) => () => void
  reassign: (id: string, newKey: string) => void
  reset: (id?: string) => void
  getKey: (id: string) => string
  handleKeyDown: (e: KeyboardEvent) => void
}

export const useShortcutStore = create<ShortcutStore>((set, get) => ({
  shortcuts: buildDefs(loadOverrides()),
  _handlers: new Map(),

  register: (id, handler) => {
    get()._handlers.set(id, handler)
    return () => { get()._handlers.delete(id) }
  },

  reassign: (id, newKey) => {
    set((s) => {
      const updated = s.shortcuts.map((sc) => sc.id === id ? { ...sc, key: newKey } : sc)
      // persist overrides
      const overrides: Record<string, string> = {}
      updated.forEach((sc) => { if (sc.key !== sc.defaultKey) overrides[sc.id] = sc.key })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
      return { shortcuts: updated }
    })
  },

  reset: (id) => {
    set((s) => {
      const updated = id
        ? s.shortcuts.map((sc) => sc.id === id ? { ...sc, key: sc.defaultKey } : sc)
        : s.shortcuts.map((sc) => ({ ...sc, key: sc.defaultKey }))
      const overrides: Record<string, string> = {}
      if (id) {
        // keep other overrides
        s.shortcuts.forEach((sc) => {
          if (sc.id !== id && sc.key !== sc.defaultKey) overrides[sc.id] = sc.key
        })
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
      return { shortcuts: updated }
    })
  },

  getKey: (id) => get().shortcuts.find((s) => s.id === id)?.key ?? '',

  handleKeyDown: (e: KeyboardEvent) => {
    // Don't fire shortcuts when typing in inputs
    const tag = (e.target as HTMLElement).tagName
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
    if ((e.target as HTMLElement).isContentEditable) return

    const combo = eventToCombo(e)
    const { shortcuts, _handlers } = get()
    const match = shortcuts.find((s) => s.key === combo)
    if (!match) return
    const handler = _handlers.get(match.id)
    if (!handler) return
    e.preventDefault()
    handler()
  },
}))
