'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Globe, HardDrive, Import, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useResearchStore, ResearchMode, ResearchDepth } from '../../stores/researchStore'
import { useSourceStore } from '../../stores/sourceStore'
import { useToastStore } from '../../stores/toastStore'
import { ws } from '../../lib/ws'
import { ResearchResult } from '../../lib/ipc'

const spring = { type: 'spring' as const, stiffness: 500, damping: 35 }

interface Props {
  notebookId: string
}

export function ResearchPanel({ notebookId }: Props) {
  const {
    results,
    selected,
    imported,
    searching,
    error,
    startSearch,
    loadResults,
    toggleSelect,
    clearSelection,
    importOne,
    importSelected,
    importAll,
    onTaskProgress,
    onTaskComplete,
    onTaskError,
  } = useResearchStore()

  const { addSource, fetchSources } = useSourceStore()
  const { show: showToast } = useToastStore()

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ResearchMode>('web')
  const [depth, setDepth] = useState<ResearchDepth>('fast')
  const [importingUrl, setImportingUrl] = useState<string | null>(null)
  const [importingMany, setImportingMany] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const state = results[notebookId]
  const isSearching = searching[notebookId] ?? false
  const searchError = error[notebookId] ?? null
  const selectedSet = selected[notebookId] ?? new Set<string>()
  const importedSet = imported[notebookId] ?? new Set<string>()
  const sources = state?.sources ?? []
  const hasResults = sources.length > 0
  const selectedCount = selectedSet.size
  const unimportedCount = sources.filter((s) => !importedSet.has(s.url)).length

  // Load any cached results on mount
  useEffect(() => {
    loadResults(notebookId)
  }, [notebookId])

  // Subscribe to WS task events for research tasks
  useEffect(() => {
    const unsubs = [
      ws.on<{ task_id: string; notebook_id: string; progress: number; message: string }>(
        'task_progress',
        (e) => {
          if (e.notebook_id === notebookId) onTaskProgress(e.task_id, notebookId, e.progress)
        }
      ),
      ws.on<{ task_id: string; notebook_id: string; artifact_type: string }>(
        'task_complete',
        (e) => {
          if (e.notebook_id === notebookId && e.artifact_type === 'research') {
            onTaskComplete(e.task_id, notebookId)
          }
        }
      ),
      ws.on<{ task_id: string; notebook_id: string; error: string }>(
        'task_error',
        (e) => {
          if (e.notebook_id === notebookId) onTaskError(e.task_id, notebookId, e.error)
        }
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [notebookId])

  const handleSearch = async () => {
    const q = query.trim()
    if (!q || isSearching) return
    try {
      await startSearch(notebookId, q, mode, depth)
    } catch (e) {
      showToast({ type: 'error', message: `Search failed: ${String(e)}` })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleImportOne = async (result: ResearchResult) => {
    if (importedSet.has(result.url) || importingUrl === result.url) return
    setImportingUrl(result.url)
    try {
      const src = await importOne(notebookId, result)
      addSource({ ...src, notebook_id: notebookId })
      showToast({ type: 'success', message: `"${result.title}" added as source` })
      // Refresh sources panel after a short delay to pick up indexing status
      setTimeout(() => fetchSources(notebookId, true), 2000)
    } catch (e) {
      showToast({ type: 'error', message: `Import failed: ${String(e)}` })
    } finally {
      setImportingUrl(null)
    }
  }

  const handleImportSelected = async () => {
    if (importingMany || selectedCount === 0) return
    setImportingMany(true)
    try {
      const imported = await importSelected(notebookId)
      imported.forEach((src) => addSource({ ...src, notebook_id: notebookId }))
      showToast({ type: 'success', message: `${imported.length} source${imported.length !== 1 ? 's' : ''} added` })
      setTimeout(() => fetchSources(notebookId, true), 2000)
    } catch (e) {
      showToast({ type: 'error', message: `Import failed: ${String(e)}` })
    } finally {
      setImportingMany(false)
    }
  }

  const handleImportAll = async () => {
    if (importingMany || unimportedCount === 0) return
    setImportingMany(true)
    try {
      const imported = await importAll(notebookId)
      imported.forEach((src) => addSource({ ...src, notebook_id: notebookId }))
      showToast({ type: 'success', message: `${imported.length} source${imported.length !== 1 ? 's' : ''} added` })
      setTimeout(() => fetchSources(notebookId, true), 2000)
    } catch (e) {
      showToast({ type: 'error', message: `Import failed: ${String(e)}` })
    } finally {
      setImportingMany(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search controls */}
      <div
        className="px-5 py-4 border-b flex flex-col gap-3"
        style={{ borderColor: 'var(--color-separator)' }}
      >
        {/* Mode + Depth toggles */}
        <div className="flex items-center gap-4">
          <SegmentedControl
            label="Mode"
            options={[
              { value: 'web', label: 'Web', icon: <Globe className="w-3.5 h-3.5" /> },
              { value: 'drive', label: 'Drive', icon: <HardDrive className="w-3.5 h-3.5" /> },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v as ResearchMode)
              // Drive only supports fast
              if (v === 'drive') setDepth('fast')
            }}
          />
          <SegmentedControl
            label="Depth"
            options={[
              { value: 'fast', label: 'Fast' },
              { value: 'deep', label: 'Deep', disabled: mode === 'drive' },
            ]}
            value={depth}
            onChange={(v) => setDepth(v as ResearchDepth)}
          />
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors"
            style={{
              background: 'var(--color-app-bg)',
              borderColor: 'var(--color-separator)',
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search the web or your Drive…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--color-text-primary)' }}
              disabled={isSearching}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: !query.trim() || isSearching ? 'var(--color-separator)' : 'var(--color-accent)',
              color: !query.trim() || isSearching ? 'var(--color-text-tertiary)' : '#fff',
              cursor: !query.trim() || isSearching ? 'not-allowed' : 'pointer',
            }}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {isSearching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Bulk action bar — shown when results exist */}
      {hasResults && !isSearching && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={spring}
          className="flex items-center justify-between px-5 py-2 border-b"
          style={{ borderColor: 'var(--color-separator)', background: 'var(--color-app-bg)' }}
        >
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {sources.length} result{sources.length !== 1 ? 's' : ''}
                {state?.query ? ` for "${state.query}"` : ''}
              </span>
              {selectedCount > 0 && (
                <button
                  onClick={() => clearSelection(notebookId)}
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <button
                  onClick={handleImportSelected}
                  disabled={importingMany}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {importingMany ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Import className="w-3.5 h-3.5" />}
                  Import Selected ({selectedCount})
                </button>
              )}
              {unimportedCount > 0 && selectedCount === 0 && (
                <button
                  onClick={handleImportAll}
                  disabled={importingMany}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                  style={{ borderColor: 'var(--color-separator)', color: 'var(--color-text-primary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {importingMany ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Import className="w-3.5 h-3.5" />}
                  Import All ({unimportedCount})
                </button>
              )}
            </div>
          </motion.div>
        )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Searching state */}
        {isSearching && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Searching{mode === 'drive' ? ' your Drive' : ' the web'}…
            </p>
          </div>
        )}

        {/* Error state */}
        {!isSearching && searchError && (
          <div className="mx-5 my-4 rounded-xl px-4 py-3 text-sm flex items-start gap-2"
            style={{ background: 'rgba(255,69,58,0.08)', color: 'var(--color-error)' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Empty state — no search yet */}
        {!isSearching && !searchError && !hasResults && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-8">
            <Search className="w-10 h-10" style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Research the web or your Drive
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Enter a query above to find relevant sources and import them directly into this notebook.
            </p>
          </div>
        )}

        {/* Results list */}
        {!isSearching && hasResults && (
          <div className="divide-y" style={{ borderColor: 'var(--color-separator)' }}>
            {sources.map((result, i) => (
              <ResultRow
                key={result.url}
                result={result}
                isSelected={selectedSet.has(result.url)}
                isImported={importedSet.has(result.url)}
                isImporting={importingUrl === result.url}
                onToggle={() => toggleSelect(notebookId, result.url)}
                onImport={() => handleImportOne(result)}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ResultRow ─────────────────────────────────────────────────────────────────

interface ResultRowProps {
  result: ResearchResult
  isSelected: boolean
  isImported: boolean
  isImporting: boolean
  onToggle: () => void
  onImport: () => void
  index: number
}

function ResultRow({ result, isSelected, isImported, isImporting, onToggle, onImport, index }: ResultRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: index * 0.03 }}
      className="flex items-start gap-3 px-5 py-3 transition-colors"
      style={{ background: isSelected ? 'var(--color-accent-subtle)' : 'transparent' }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--color-app-bg)'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Checkbox */}
      <button
        onClick={isImported ? undefined : onToggle}
        className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
        style={{
          borderColor: isImported ? 'var(--color-success)' : isSelected ? 'var(--color-accent)' : 'var(--color-separator)',
          background: isImported ? 'rgba(48,209,88,0.12)' : isSelected ? 'var(--color-accent)' : 'transparent',
          cursor: isImported ? 'default' : 'pointer',
        }}
        aria-label={isImported ? 'Already imported' : isSelected ? 'Deselect' : 'Select'}
      >
        {isImported && <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--color-success)' }} />}
        {!isImported && isSelected && (
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-text-primary)' }}
              title={result.title}
            >
              {result.title || result.url}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
              {result.domain}
            </p>
            {result.snippet && (
              <p
                className="text-xs mt-1 line-clamp-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {result.snippet}
              </p>
            )}
          </div>

          {/* Action */}
          <div className="flex-shrink-0 mt-0.5">
            {isImported ? (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'rgba(48,209,88,0.12)',
                  color: 'var(--color-success)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  padding: '2px 8px',
                }}
              >
                Imported
              </span>
            ) : (
              <button
                onClick={onImport}
                disabled={isImporting}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border"
                style={{
                  borderColor: 'var(--color-separator)',
                  color: 'var(--color-text-primary)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)'
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = 'var(--color-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                  e.currentTarget.style.borderColor = 'var(--color-separator)'
                }}
              >
                {isImporting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Import className="w-3 h-3" />
                )}
                Import
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── SegmentedControl ──────────────────────────────────────────────────────────

interface SegOption {
  value: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: SegOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {label}:
      </span>
      <div
        className="flex rounded-full p-0.5"
        style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)' }}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !opt.disabled && onChange(opt.value)}
            disabled={opt.disabled}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              background: value === opt.value ? 'var(--color-accent)' : 'transparent',
              color: opt.disabled
                ? 'var(--color-text-tertiary)'
                : value === opt.value
                ? '#fff'
                : 'var(--color-text-secondary)',
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
              opacity: opt.disabled ? 0.5 : 1,
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
