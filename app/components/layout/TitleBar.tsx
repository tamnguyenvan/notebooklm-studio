'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, MessageSquare, Settings, LogOut, CheckCheck, X, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../stores/authStore'
import { useNotificationStore, AppNotification } from '../../stores/notificationStore'

const FEEDBACK_URL = 'https://feedback.notebooklm-studio.app'

interface TitleBarProps {
  onSettingsOpen: () => void
}

export function TitleBar({ onSettingsOpen }: TitleBarProps) {
  const { account, logout } = useAuthStore()
  const { notifications, markRead, markAllRead, remove, clear, unreadCount } = useNotificationStore()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [notiOpen, setNotiOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)
  const notiRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) setNotiOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = unreadCount()

  const initials = account?.display_name
    ? account.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : account?.email ? account.email[0].toUpperCase() : '?'

  const openFeedback = () => {
    invoke('open_url', { url: FEEDBACK_URL }).catch(() => {
      window.open(FEEDBACK_URL, '_blank')
    })
  }

  const handleNotiClick = (n: AppNotification) => {
    markRead(n.id)
    n.action?.onClick()
  }

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
      {/* Traffic lights zone */}
      <div className="w-[80px] shrink-0" data-tauri-drag-region />

      {/* App name */}
      <div className="flex shrink-0 items-center gap-2 select-none" data-tauri-drag-region style={{ color: 'var(--color-text-primary)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-5 w-5" draggable={false} />
        <span className="text-sm font-semibold">NotebookLM Studio</span>
      </div>

      {/* Drag spacer */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Right controls */}
      <div className="flex items-center gap-1 pr-3">

        {/* Feedback */}
        <button
          onClick={openFeedback}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          style={{ border: '1px solid var(--color-separator)', color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
        >
          <MessageSquare size={12} />
          Feedback
        </button>

        {/* Notifications */}
        <div className="relative" ref={notiRef}>
          <button
            onClick={() => { setNotiOpen((v) => !v); setAvatarOpen(false) }}
            className="relative flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          >
            <Bell size={15} />
            {unread > 0 && (
              <span
                className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: 'var(--color-accent)', lineHeight: 1 }}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          <AP>
            {notiOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute right-0 top-10 w-80 rounded-xl shadow-xl overflow-hidden"
                style={{ background: 'var(--color-content-bg)', border: '1px solid var(--color-separator)', zIndex: 200 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-separator)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Notifications
                    {unread > 0 && (
                      <span
                        className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        {unread}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                        style={{ color: 'var(--color-accent)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-subtle)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        title="Mark all read"
                      >
                        <CheckCheck size={12} />
                        All read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clear}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)' }}
                        title="Clear all"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10">
                      <Bell size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No notifications</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <NotiRow key={n.id} n={n} onClick={() => handleNotiClick(n)} onRemove={() => remove(n.id)} />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AP>
        </div>

        {/* Avatar */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => { setAvatarOpen((v) => !v); setNotiOpen(false) }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-accent)' }}
            title={account?.display_name ?? account?.email ?? 'Account'}
          >
            {initials}
          </button>

          <AP>
            {avatarOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className="absolute right-0 top-9 w-52 rounded-xl py-1 shadow-xl"
                style={{ background: 'var(--color-content-bg)', border: '1px solid var(--color-separator)', zIndex: 200 }}
              >
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--color-separator)' }}>
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {account?.display_name ?? account?.email ?? 'Account'}
                  </p>
                  {account?.display_name && (
                    <p className="truncate text-xs" style={{ color: 'var(--color-text-secondary)' }}>{account.email}</p>
                  )}
                </div>
                <DropdownItem icon={<Settings size={13} />} label="Settings" onClick={() => { setAvatarOpen(false); onSettingsOpen() }} />
                <DropdownItem icon={<LogOut size={13} />} label="Sign out" onClick={() => { setAvatarOpen(false); logout() }} danger />
              </motion.div>
            )}
          </AP>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const KIND_COLORS: Record<AppNotification['kind'], string> = {
  success: '#34C759',
  error: 'var(--color-error)',
  warning: '#FF9F0A',
  info: 'var(--color-accent)',
}

const KIND_BG: Record<AppNotification['kind'], string> = {
  success: 'rgba(52,199,89,0.12)',
  error: 'rgba(255,69,58,0.1)',
  warning: 'rgba(255,159,10,0.12)',
  info: 'var(--color-accent-subtle)',
}

function NotiRow({ n, onClick, onRemove }: { n: AppNotification; onClick: () => void; onRemove: () => void }) {
  const elapsed = formatElapsed(n.ts)
  return (
    <div
      className="group relative flex gap-3 px-4 py-3 transition-colors"
      style={{
        background: n.read ? 'transparent' : KIND_BG[n.kind],
        borderBottom: '1px solid var(--color-separator)',
        cursor: n.action ? 'pointer' : 'default',
      }}
      onClick={n.action ? onClick : undefined}
      onMouseEnter={(e) => { if (!n.action) return; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.03)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.read ? 'transparent' : KIND_BG[n.kind] }}
    >
      {/* Unread dot */}
      {!n.read && (
        <span
          className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{ background: KIND_COLORS[n.kind] }}
        />
      )}

      {/* Kind dot / icon */}
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: KIND_BG[n.kind], color: KIND_COLORS[n.kind] }}
      >
        {n.kind === 'success' ? '✓' : n.kind === 'error' ? '✕' : n.kind === 'warning' ? '!' : 'i'}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
        {n.body && <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{n.body}</p>}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{elapsed}</span>
          {n.action && (
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>{n.action.label} →</span>
          )}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="invisible ml-1 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors group-hover:visible"
        style={{ color: 'var(--color-text-tertiary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent' }}
      >
        <X size={11} />
      </button>
    </div>
  )
}

function DropdownItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-primary)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'rgba(255,69,58,0.08)' : 'rgba(0,0,0,0.04)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      {label}
    </button>
  )
}

function formatElapsed(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
