'use client'

import { useEffect, useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search } from 'lucide-react'
import { ipc } from '../../../lib/ipc'

interface Props {
  notebookId: string
}

type SortDir = 'asc' | 'desc' | null

export function DataTableViewer({ notebookId }: Props) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  useEffect(() => {
    setLoading(true)
    ipc.getArtifactData(notebookId, 'data_table')
      .then((data: unknown) => {
        const d = data as Record<string, unknown>
        const csv = String(d?.csv ?? '')
        const { headers: h, rows: r } = parseCsv(csv)
        setHeaders(h)
        setRows(r)
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [notebookId])

  const filtered = useMemo(() => {
    if (!filter) return rows
    const q = filter.toLowerCase()
    return rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)))
  }, [rows, filter])

  const sorted = useMemo(() => {
    if (sortCol === null || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      const numA = parseFloat(av)
      const numB = parseFloat(bv)
      const isNum = !isNaN(numA) && !isNaN(numB)
      const cmp = isNum ? numA - numB : av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const toggleSort = (col: number) => {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortCol(null); setSortDir(null) }
  }

  const exportCsv = () => {
    const lines = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'data_table.csv'
    a.click()
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
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--color-separator)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full border"
            style={{
              background: 'var(--color-app-bg)',
              borderColor: 'var(--color-separator)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={exportCsv}
          className="px-2.5 py-1.5 rounded text-xs font-medium border transition-colors"
          style={{ borderColor: 'var(--color-separator)', color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'var(--color-app-bg)', borderBottom: '1px solid var(--color-separator)' }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => toggleSort(i)}
                  className="px-3 py-2 text-left font-semibold cursor-pointer select-none whitespace-nowrap"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span className="flex items-center gap-1">
                    {h}
                    {sortCol === i ? (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                      <span className="w-3 h-3 opacity-0 group-hover:opacity-100">↕</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr
                key={ri}
                style={{ borderBottom: '1px solid var(--color-separator)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2" style={{ color: 'var(--color-text-primary)' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No results</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t text-xs" style={{ borderColor: 'var(--color-separator)', color: 'var(--color-text-tertiary)' }}>
        {sorted.length} of {rows.length} rows
      </div>
    </div>
  )
}

function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const parse = (line: string): string[] => {
    const result: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }
  const headers = parse(lines[0])
  const rows = lines.slice(1).map(parse)
  return { headers, rows }
}
