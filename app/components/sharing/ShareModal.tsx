'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AP = AnimatePresence as any
import { X, Link, Check, UserPlus, Trash2, Globe, Lock, ChevronDown } from 'lucide-react'
import { useSharingStore } from '../../stores/sharingStore'
import { useToastStore } from '../../stores/toastStore'
import { SharePermission } from '../../lib/ipc'

const spring = { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] as const }
const dropdownTransition = { duration: 0.13, ease: [0.25, 0.1, 0.25, 1] as const }

// ── Custom permission dropdown ────────────────────────────────────────────────

const PERMISSION_OPTIONS: { value: SharePermission; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
]

function PermissionSelect({
  value,
  onChange,
}: {
  value: SharePermission
  onChange: (v: SharePermission) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = PERMISSION_OPTIONS.find((o) => o.value === value)!

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
        style={{
          background: 'var(--color-app-bg)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-separator)',
          minWidth: '80px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-separator)')}
      >
        <span className="flex-1 text-left">{selected.label}</span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{
            color: 'var(--color-text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      <AP>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={dropdownTransition}
            className="absolute top-full mt-1 right-0 rounded-xl overflow-hidden z-50"
            style={{
              background: 'var(--color-elevated)',
              border: '1px solid var(--color-separator)',
              boxShadow: 'var(--shadow-lg)',
              minWidth: '100px',
            }}
          >
            {PERMISSION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {opt.label}
                {opt.value === value && <Check className="w-3 h-3" style={{ color: 'var(--color-accent)' }} />}
              </button>
            ))}
          </motion.div>
        )}
      </AP>
    </div>
  )
}

interface Props {
  notebookId: string
  notebookTitle: string
  onClose?: () => void
  inline?: boolean
}

export function ShareModal({ notebookId, notebookTitle, onClose, inline }: Props) {
  const { status, loading, fetchStatus, setPublic, addUser, removeUser } = useSharingStore()
  const { show } = useToastStore()

  const shareStatus = status[notebookId]
  const isLoading = loading[notebookId] ?? false

  const [toggling, setToggling] = useState(false)
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<SharePermission>('viewer')
  const [notify, setNotify] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus(notebookId)
  }, [notebookId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleTogglePublic = async () => {
    if (!shareStatus || toggling) return
    setToggling(true)
    try {
      await setPublic(notebookId, !shareStatus.is_public)
    } catch (e) {
      show({ type: 'error', message: `Failed: ${String(e)}` })
    } finally {
      setToggling(false)
    }
  }

  const handleCopyLink = useCallback(() => {
    const url = shareStatus?.share_url
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareStatus?.share_url])

  const handleAddUser = async () => {
    const trimmed = email.trim()
    if (!trimmed || adding) return
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      show({ type: 'error', message: 'Enter a valid email address' })
      return
    }
    setAdding(true)
    try {
      await addUser(notebookId, trimmed, permission, notify, '')
      setEmail('')
      show({ type: 'success', message: `Shared with ${trimmed}` })
    } catch (e) {
      show({ type: 'error', message: `Failed to share: ${String(e)}` })
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveUser = async (userEmail: string) => {
    setRemovingEmail(userEmail)
    try {
      await removeUser(notebookId, userEmail)
      show({ type: 'success', message: `Removed ${userEmail}` })
    } catch (e) {
      show({ type: 'error', message: `Failed to remove: ${String(e)}` })
    } finally {
      setRemovingEmail(null)
    }
  }

  const content = (
    <div className="px-5 pb-5 flex flex-col gap-5">
          {/* Public link section */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--color-app-bg)', border: '1px solid var(--color-separator)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {shareStatus?.is_public
                  ? <Globe className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                  : <Lock className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
                }
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {shareStatus?.is_public ? 'Anyone with the link' : 'Link sharing off'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {shareStatus?.is_public ? 'Can view this notebook' : 'Only invited people can access'}
                  </p>
                </div>
              </div>
              {/* Toggle */}
              <button
                onClick={handleTogglePublic}
                disabled={toggling || isLoading}
                className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                style={{
                  background: shareStatus?.is_public ? 'var(--color-accent)' : 'var(--color-separator)',
                  opacity: toggling || isLoading ? 0.6 : 1,
                }}
              >
                <motion.span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ left: shareStatus?.is_public ? '18px' : '2px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              </button>
            </div>

            {/* Copy link row — only when public */}
            <AP>
              {shareStatus?.is_public && shareStatus.share_url && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  <input
                    readOnly
                    value={shareStatus.share_url}
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none truncate"
                    style={{
                      background: 'var(--color-content-bg)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-separator)',
                    }}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors"
                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Link className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </motion.div>
              )}
            </AP>
          </div>

          {/* Invite people section */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
              Invite people
            </p>

            {/* Email input row */}
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddUser() }}
                placeholder="Email address"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--color-app-bg)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-separator)',
                }}
              />
              {/* Permission selector */}
              <PermissionSelect value={permission} onChange={setPermission} />
              <button
                onClick={handleAddUser}
                disabled={!email.trim() || adding}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-colors"
                style={{
                  background: email.trim() && !adding ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                  color: '#fff',
                }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                {adding ? '…' : 'Invite'}
              </button>
            </div>

            {/* Notify toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Notify by email
              </span>
            </label>
          </div>

          {/* Shared users list */}
          {shareStatus && shareStatus.shared_users.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                People with access
              </p>
              {shareStatus.shared_users.map((user) => (
                <div
                  key={user.email}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--color-app-bg)' }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
                  >
                    {user.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {user.email}
                    </p>
                    <p className="text-xs capitalize" style={{ color: 'var(--color-text-tertiary)' }}>
                      {user.permission}
                    </p>
                  </div>
                  {user.permission !== 'owner' && (
                    <button
                      onClick={() => handleRemoveUser(user.email)}
                      disabled={removingEmail === user.email}
                      className="p-1.5 rounded-lg transition-colors shrink-0"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                      title="Remove access"
                    >
                      {removingEmail === user.email
                        ? <span className="text-xs">…</span>
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Loading state */}
          {isLoading && !shareStatus && (
            <div className="flex items-center justify-center py-4">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading…</p>
            </div>
          )}
    </div>
  )

  // Inline mode: render content directly (for right panel)
  if (inline) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{notebookTitle}</p>
        </div>
        {content}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={spring}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-elevated)', boxShadow: 'var(--shadow-xl)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Share notebook
            </h2>
            <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {notebookTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-app-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {content}
      </motion.div>
    </motion.div>
  )
}
