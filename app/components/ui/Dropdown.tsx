'use client'

/**
 * Reusable macOS-style dropdown / select component.
 *
 * Two usage modes:
 *
 * 1. Select mode — renders a trigger button showing the selected label + chevron.
 *    Pass `options` + `value` + `onChange`.
 *
 * 2. Menu mode — renders an arbitrary trigger (children) with a popover menu.
 *    Pass `items` + `trigger`.
 *
 * Both share the same animated popover panel.
 */

import { useRef, useState, useEffect, useId } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const spring = { duration: 0.13, ease: [0.25, 0.1, 0.25, 1] as const }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any

// ── Shared popover animation ──────────────────────────────────────────────────

function Popover({
  open,
  align = 'left',
  width,
  children,
}: {
  open: boolean
  align?: 'left' | 'right'
  width?: number | string
  children: React.ReactNode
}) {
  return (
    <AP>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={spring}
          className="absolute top-[calc(100%+6px)] z-[200] overflow-hidden rounded-xl py-1.5"
          style={{
            [align === 'right' ? 'right' : 'left']: 0,
            width: width ?? 'max-content',
            minWidth: '100%',
            background: 'var(--color-elevated)',
            border: '1px solid var(--color-separator)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {children}
        </motion.div>
      )}
    </AP>
  )
}

// ── Menu item ─────────────────────────────────────────────────────────────────

export interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  separator?: boolean
  disabled?: boolean
}

function MenuItemRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  if (item.separator) {
    return <div className="my-1 h-px" style={{ background: 'var(--color-separator)' }} />
  }
  return (
    <button
      disabled={item.disabled}
      onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
      style={{
        color: item.danger
          ? 'var(--color-error)'
          : item.disabled
          ? 'var(--color-text-tertiary)'
          : 'var(--color-text-primary)',
        cursor: item.disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!item.disabled)
          e.currentTarget.style.background = item.danger
            ? 'rgba(255,69,58,0.08)'
            : 'rgba(0,0,0,0.04)'
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {item.icon && (
        <span className="flex w-4 items-center justify-center shrink-0">{item.icon}</span>
      )}
      <span className="flex-1 text-left">{item.label}</span>
    </button>
  )
}

// ── Select option ─────────────────────────────────────────────────────────────

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  icon?: React.ReactNode
}

// ── Select mode ───────────────────────────────────────────────────────────────

interface SelectProps<T extends string = string> {
  options: SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  placeholder?: string
  align?: 'left' | 'right'
  /** Width of the trigger button. Defaults to auto. */
  triggerClassName?: string
  triggerStyle?: React.CSSProperties
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  align = 'left',
  triggerClassName,
  triggerStyle,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors select-none',
          triggerClassName ?? '',
        ].join(' ')}
        style={{
          background: open ? 'var(--color-app-bg)' : 'transparent',
          border: '1px solid var(--color-separator)',
          color: 'var(--color-text-primary)',
          ...triggerStyle,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-app-bg)' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        {selected?.icon && (
          <span className="flex items-center shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
            {selected.icon}
          </span>
        )}
        <span className="truncate" style={{ maxWidth: 160 }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform"
          style={{
            color: 'var(--color-text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      <Popover open={open} align={align}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            {opt.icon && (
              <span className="flex w-4 items-center justify-center shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                {opt.icon}
              </span>
            )}
            <span className="flex-1 text-left truncate">{opt.label}</span>
            {opt.value === value && (
              <Check size={13} className="shrink-0" style={{ color: 'var(--color-accent)' }} />
            )}
          </button>
        ))}
      </Popover>
    </div>
  )
}

// ── Menu mode ─────────────────────────────────────────────────────────────────

interface MenuProps {
  trigger: React.ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional header content rendered above the items */
  header?: React.ReactNode
  width?: number | string
}

export function Menu({ trigger, items, align = 'right', open, onOpenChange, header, width }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      <Popover open={open} align={align} width={width}>
        {header && (
          <>
            <div className="px-3 py-2.5">{header}</div>
            <div className="h-px" style={{ background: 'var(--color-separator)' }} />
          </>
        )}
        {items.map((item, i) => (
          <MenuItemRow key={i} item={item} onClose={() => onOpenChange(false)} />
        ))}
      </Popover>
    </div>
  )
}
