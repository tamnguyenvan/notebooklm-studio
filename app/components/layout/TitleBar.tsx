'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, MessageSquare, Settings, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SafeAnimatePresence = AnimatePresence as any
import { useAuthStore } from '../../stores/authStore'
import { useNotebookStore } from '../../stores/notebookStore'

interface TitleBarProps {
  onSettingsOpen: () => void
}

export function TitleBar({ onSettingsOpen }: TitleBarProps) {
  const { account, logout } = useAuthStore()
  const { activeNotebookId } = useNotebookStore()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = account?.display_name
    ? account.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : account?.email
    ? account.email[0].toUpperCase()
    : '?'

  return (
    <div
      className="relative flex h-[52px] w-full shrink-0 items-center"
      data-tauri-drag-region
      style={{
        background: 'var(--color-sidebar-bg)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderBottom: '1px solid var(--color-separator)',
        zIndex: 50,
      }}
    >
      {/* Traffic lights zone — 80px left inset on macOS */}
      <div className="w-[80px] shrink-0" data-tauri-drag-region />

      {/* App name — left of center content */}
      <div
        className="flex shrink-0 items-center gap-2 select-none"
        data-tauri-drag-region
        style={{ color: 'var(--color-text-primary)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-5 w-5" draggable={false} />
        <span className="text-sm font-semibold">NotebookLM Studio</span>
      </div>

      {/* Spacer — draggable */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Right controls — NOT drag region */}
      <div className="flex items-center gap-1 pr-3">
        {/* Feedback */}
        <button
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          style={{
            border: '1px solid var(--color-separator)',
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onClick={() => {
            // open feedback URL or modal
          }}
        >
          <MessageSquare size={12} />
          Feedback
        </button>

        {/* Bell */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
        >
          <Bell size={15} />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-accent)' }}
            title={account?.display_name ?? account?.email ?? 'Account'}
          >
            {initials}
          </button>

          <SafeAnimatePresence>
            {avatarOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute right-0 top-9 w-52 rounded-xl py-1 shadow-xl"
                style={{
                  background: 'var(--color-content-bg)',
                  border: '1px solid var(--color-separator)',
                  zIndex: 200,
                }}
              >
                {/* Account info */}
                <div
                  className="px-3 py-2"
                  style={{ borderBottom: '1px solid var(--color-separator)' }}
                >
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {account?.display_name ?? account?.email ?? 'Account'}
                  </p>
                  {account?.display_name && (
                    <p className="truncate text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {account.email}
                    </p>
                  )}
                </div>

                {/* Settings */}
                <DropdownItem
                  icon={<Settings size={13} />}
                  label="Settings"
                  onClick={() => { setAvatarOpen(false); onSettingsOpen() }}
                />

                {/* Sign out */}
                <DropdownItem
                  icon={<LogOut size={13} />}
                  label="Sign out"
                  onClick={() => { setAvatarOpen(false); logout() }}
                  danger
                />
              </motion.div>
            )}
          </SafeAnimatePresence>
        </div>
      </div>
    </div>
  )
}

function DropdownItem({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-primary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'rgba(0,0,0,0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
