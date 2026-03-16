'use client'

import React from 'react'
import { Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

export function Sidebar() {
  const { account, logout } = useAuthStore()

  const initials = account?.display_name
    ? account.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : account?.email
    ? account.email[0].toUpperCase()
    : '?'

  return (
    <div
      className="flex h-full w-[240px] shrink-0 flex-col"
      style={{
        background: 'var(--color-sidebar-bg)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderRight: '1px solid var(--color-separator)',
      }}
    >
      {/* Account row */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-separator)' }}
      >
        {/* Avatar */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: 'var(--color-accent)' }}
        >
          {initials}
        </div>
        {/* Name / email */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {account?.display_name ?? account?.email ?? 'Account'}
          </p>
          {account?.display_name && (
            <p
              className="truncate text-xs leading-tight"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {account.email}
            </p>
          )}
        </div>
      </div>

      {/* Nav items will be added in Module 2+ */}
      <div className="flex-1" />

      {/* Bottom: Settings + Logout */}
      <div
        className="flex flex-col gap-1 p-2"
        style={{ borderTop: '1px solid var(--color-separator)' }}
      >
        <SidebarLink icon={<Settings size={16} />} label="Settings" onClick={() => {}} />
        <SidebarLink
          icon={<LogOut size={16} />}
          label="Sign out"
          onClick={logout}
          danger
        />
      </div>
    </div>
  )
}

function SidebarLink({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-100"
      style={{
        color: danger ? 'var(--color-error)' : 'var(--color-text-secondary)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = danger
          ? 'rgba(255,69,58,0.08)'
          : 'rgba(0,0,0,0.04)'
        ;(e.currentTarget as HTMLButtonElement).style.color = danger
          ? 'var(--color-error)'
          : 'var(--color-text-primary)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.color = danger
          ? 'var(--color-error)'
          : 'var(--color-text-secondary)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
