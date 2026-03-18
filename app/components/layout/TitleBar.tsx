'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, MessageSquare, Settings, LogOut, CheckCheck, X, Trash2, PanelLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { useAuthStore } from '../../stores/authStore'
import { useNotificationStore, AppNotification } from '../../stores/notificationStore'
import { Menu } from '../ui/Dropdown'

const FEEDBACK_URL = 'https://feedback.notebooklm-studio.app'

// Detect platform once at module load (window.__TAURI_OS_PLUGIN_INTERNALS__ not needed —
// we use the user-agent as a lightweight heuristic; Tauri sets navigator.userAgent normally)
function getPlatform(): 'macos' | 'windows' | 'linux' {
  if (typeof navigator === 'undefined') return 'linux'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  return 'linux'
}
const PLATFORM = getPlatform()

interface TitleBarProps {
  onSettingsOpen: () => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
  onToggleStudio?: () => void
  studioOpen?: boolean
}

export function TitleBar({ onSettingsOpen, onToggleSidebar, sidebarOpen, onToggleStudio, studioOpen }: TitleBarProps) {
  const { account, logout } = useAuthStore()
  const { notifications, markRead, markAllRead, remove, clear, unreadCount } = useNotificationStore()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [notiOpen, setNotiOpen] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const notiRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Track maximized state for the maximize icon
  useEffect(() => {
    const win = getCurrentWindow()
    win.isMaximized().then(setIsMaximized)
    const unlisten = win.onResized(() => win.isMaximized().then(setIsMaximized))
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) setNotiOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Manual drag: mousedown on the bar itself (not on interactive children)
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const handler = (e: MouseEvent) => {
      // Only primary button, only direct bar / drag-region children
      if (e.buttons !== 1) return
      const target = e.target as HTMLElement
      // Skip if clicking a button, input, or any interactive element
      if (target.closest('button, input, a, [role="button"]')) return
      if (e.detail === 2) {
        getCurrentWindow().toggleMaximize()
      } else {
        getCurrentWindow().startDragging()
      }
    }
    bar.addEventListener('mousedown', handler)
    return () => bar.removeEventListener('mousedown', handler)
  }, [])

  const unread = unreadCount()
  const initials = account?.display_name
    ? account.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : account?.email ? account.email[0].toUpperCase() : '?'

  const openFeedback = () => {
    invoke('open_url', { url: FEEDBACK_URL }).catch(() => window.open(FEEDBACK_URL, '_blank'))
  }

  const win = () => getCurrentWindow()

  return (
    <div
      ref={barRef}
      className="relative flex h-[52px] w-full shrink-0 items-center select-none"
      style={{
        background: 'var(--color-sidebar-bg)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderBottom: '1px solid var(--color-separator)',
        zIndex: 50,
      }}
    >
      {/* ── Left inset: traffic lights (macOS/Linux) or window controls (Windows) + sidebar toggle ── */}
      {PLATFORM === 'macos' ? (
        // macOS: native traffic lights occupy the 80px inset; toggle sits right after
        <div className="flex w-[80px] shrink-0 items-center justify-end pr-1">
          <SidebarToggle open={sidebarOpen} onClick={onToggleSidebar} />
        </div>
      ) : PLATFORM === 'linux' ? (
        <div className="flex items-center gap-[7px] pl-[18px] pr-1">
          <TrafficDot color="#FF5F57" hoverColor="#FF3B30" title="Close"    onClick={() => win().close()} />
          <TrafficDot color="#FEBC2E" hoverColor="#FF9500" title="Minimize" onClick={() => win().minimize()} />
          <TrafficDot color="#28C840" hoverColor="#34C759" title="Maximize" onClick={() => win().toggleMaximize()} />
          <div className="ml-12">
            <SidebarToggle open={sidebarOpen} onClick={onToggleSidebar} />
          </div>
        </div>
      ) : (
        // Windows: window controls on left, then toggle
        <div className="flex items-center">
          <WinBtn title="Minimize" onClick={() => win().minimize()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 13H5v-2h14z"/>
            </svg>
          </WinBtn>
          <WinBtn title={isMaximized ? 'Restore' : 'Maximize'} onClick={() => win().toggleMaximize()}>
            {isMaximized ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                <path fill="currentColor" d="M4 8h4V4h12v12h-4v4H4zm12 0v6h2V6h-8v2zM6 10v8h8v-8z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                <path fill="currentColor" d="M4 4h16v16H4zm2 4v10h12V8z"/>
              </svg>
            )}
          </WinBtn>
          <WinBtn title="Close" onClick={() => win().close()} danger>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/>
            </svg>
          </WinBtn>
          <div className="ml-1 mr-2">
            <SidebarToggle open={sidebarOpen} onClick={onToggleSidebar} />
          </div>
        </div>
      )}

      {/* Drag spacer */}
      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-1 pr-3">

        {/* Studio panel toggle */}
        {onToggleStudio && (
          <button
            onClick={onToggleStudio}
            className="flex items-center justify-center h-7 w-7 rounded-md transition-colors"
            title={studioOpen ? 'Hide Studio' : 'Show Studio'}
            style={{ color: studioOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.07)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = studioOpen ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
          >
            <PanelLeft size={15} style={{ transform: 'scaleX(-1)' }} />
          </button>
        )}

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
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute right-0 top-10 w-80 overflow-hidden rounded-xl shadow-xl"
                style={{ background: 'var(--color-content-bg)', border: '1px solid var(--color-separator)', zIndex: 200 }}
              >
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-separator)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Notifications
                    {unread > 0 && (
                      <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-accent)' }}>
                        {unread}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    {unread > 0 && (
                      <button onClick={markAllRead} className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors" style={{ color: 'var(--color-accent)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-subtle)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                        <CheckCheck size={12} /> All read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clear} className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors" style={{ color: 'var(--color-text-tertiary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10">
                      <Bell size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>No notifications</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <NotiRow key={n.id} n={n} onClick={() => { markRead(n.id); n.action?.onClick() }} onRemove={() => remove(n.id)} />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AP>
        </div>

        {/* Avatar */}
        <Menu
          open={avatarOpen}
          onOpenChange={(v) => { setAvatarOpen(v); if (v) setNotiOpen(false) }}
          align="right"
          width={208}
          header={
            <div>
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {account?.display_name ?? account?.email ?? 'Account'}
              </p>
              {account?.display_name && (
                <p className="truncate text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{account.email}</p>
              )}
            </div>
          }
          items={[
            {
              icon: <Settings size={13} />,
              label: 'Settings',
              onClick: () => { setAvatarOpen(false); onSettingsOpen() },
            },
            {
              icon: <LogOut size={13} />,
              label: 'Sign out',
              onClick: () => { setAvatarOpen(false); logout() },
              danger: true,
            },
          ]}
          trigger={
            <button
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-accent)' }}
              title={account?.display_name ?? account?.email ?? 'Account'}
            >
              {initials}
            </button>
          }
        />
      </div>
    </div>
  )
}

// ── Window control primitives ─────────────────────────────────────────────────

function SidebarToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      title={open ? 'Hide sidebar' : 'Show sidebar'}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
      style={{ color: open ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.07)'
        e.currentTarget.style.color = 'var(--color-text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = open ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
      }}
    >
      <PanelLeft size={15} />
    </button>
  )
}

function TrafficDot({ color, hoverColor, title, onClick }: {
  color: string; hoverColor: string; title: string; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors"
      style={{ background: hovered ? hoverColor : color, flexShrink: 0 }}
    >
      {hovered && (
        <span className="text-[7px] font-black leading-none" style={{ color: 'rgba(0,0,0,0.5)' }}>
          {title === 'Close' ? '✕' : title === 'Minimize' ? '−' : '+'}
        </span>
      )}
    </button>
  )
}

function WinBtn({ children, title, onClick, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-[52px] w-11 items-center justify-center transition-colors"
      style={{ color: 'var(--color-text-secondary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#C42B1C' : 'rgba(0,0,0,0.08)'
        e.currentTarget.style.color = danger ? '#fff' : 'var(--color-text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-secondary)'
      }}
    >
      {children}
    </button>
  )
}

// ── Notification row ──────────────────────────────────────────────────────────

const KIND_COLORS: Record<AppNotification['kind'], string> = {
  success: '#34C759', error: 'var(--color-error)', warning: '#FF9F0A', info: 'var(--color-accent)',
}
const KIND_BG: Record<AppNotification['kind'], string> = {
  success: 'rgba(52,199,89,0.12)', error: 'rgba(255,69,58,0.1)',
  warning: 'rgba(255,159,10,0.12)', info: 'var(--color-accent-subtle)',
}

function NotiRow({ n, onClick, onRemove }: { n: AppNotification; onClick: () => void; onRemove: () => void }) {
  return (
    <div
      className="group relative flex gap-3 px-4 py-3 transition-colors"
      style={{
        background: n.read ? 'transparent' : KIND_BG[n.kind],
        borderBottom: '1px solid var(--color-separator)',
        cursor: n.action ? 'pointer' : 'default',
      }}
      onClick={n.action ? onClick : undefined}
      onMouseEnter={(e) => { if (n.action) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.03)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.read ? 'transparent' : KIND_BG[n.kind] }}
    >
      {!n.read && (
        <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ background: KIND_COLORS[n.kind] }} />
      )}
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: KIND_BG[n.kind], color: KIND_COLORS[n.kind] }}>
        {n.kind === 'success' ? '✓' : n.kind === 'error' ? '✕' : n.kind === 'warning' ? '!' : 'i'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
        {n.body && <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{n.body}</p>}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{formatElapsed(n.ts)}</span>
          {n.action && <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>{n.action.label} →</span>}
        </div>
      </div>
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

function formatElapsed(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
