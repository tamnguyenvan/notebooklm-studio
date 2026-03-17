'use client'

import { useRef, useCallback } from 'react'

interface Props {
  value: number        // 0–1
  onChange: (v: number) => void
  width?: number | string
}

export function Slider({ value, onChange, width = 80 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  const resolve = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    onChange(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)))
  }, [onChange])

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    resolve(e.clientX)
    const onMove = (ev: MouseEvent) => resolve(ev.clientX)
    const onUp   = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const pct = `${value * 100}%`

  return (
    <div
      ref={trackRef}
      onMouseDown={onMouseDown}
      className="relative flex items-center cursor-pointer select-none group"
      style={{ width, height: 16 }}
    >
      {/* Track background */}
      <div
        className="absolute inset-x-0 rounded-full"
        style={{
          height: 3,
          background: 'var(--color-separator)',
        }}
      />
      {/* Filled portion */}
      <div
        className="absolute left-0 rounded-full"
        style={{
          height: 3,
          width: pct,
          background: 'var(--color-accent)',
        }}
      />
      {/* Thumb */}
      <div
        className="absolute -translate-x-1/2 rounded-full transition-transform duration-100 group-hover:scale-110"
        style={{
          left: pct,
          width: 12,
          height: 12,
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)',
        }}
      />
    </div>
  )
}
