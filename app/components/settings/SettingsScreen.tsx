'use client'

import { useState, useEffect } from 'react'
import { Palette, Download, User, Info, FolderOpen, Keyboard } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { ShortcutsTab } from './ShortcutsTab'
import { appStore } from '../../stores/appStore'

type Tab = 'appearance' | 'downloads' | 'shortcuts' | 'account' | 'about'
type Theme = 'light' | 'dark' | 'system'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { id: 'downloads',  label: 'Downloads',  icon: <Download size={15} /> },
  { id: 'shortcuts',  label: 'Shortcuts',  icon: <Keyboard size={15} /> },
  { id: 'account',    label: 'Account',    icon: <User size={15} /> },
  { id: 'about',      label: 'About',      icon: <Info size={15} /> },
]

export function SettingsScreen() {
  const { account, logout } = useAuthStore()
  const [tab, setTab] = useState<Tab>('appearance')
  const [theme, setTheme] = useState<Theme>('system')
  const [downloadFolder, setDownloadFolder] = useState('')

  useEffect(() => {
    appStore.get<Theme>('settings.theme').then((saved) => {
      if (saved) setTheme(saved)
    }).catch(() => {})
    appStore.get<string>('settings.downloadFolder').then((folder) => {
      if (folder) setDownloadFolder(folder)
    }).catch(() => {})
  }, [])

  const applyTheme = (t: Theme) => {
    setTheme(t)
    void appStore.set('settings.theme', t)
    const root = document.documentElement
    if (t === 'dark') root.setAttribute('data-theme', 'dark')
    else if (t === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
  }

  const pickFolder = async () => {
    try {
      const selected = await openDialog({ directory: true, multiple: false })
      if (typeof selected === 'string') {
        setDownloadFolder(selected)
        void appStore.set('settings.downloadFolder', selected)
      }
    } catch {
      // user cancelled
    }
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--color-app-bg)' }}>
      {/* Tab sidebar */}
      <div
        className="flex w-44 shrink-0 flex-col gap-0.5 p-3"
        style={{ borderRight: '1px solid var(--color-separator)' }}
      >
        <p
          className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Settings
        </p>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
              style={{
                background: active ? 'var(--color-accent-subtle)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                fontWeight: active ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'appearance' && <AppearanceTab theme={theme} onThemeChange={applyTheme} />}
          {tab === 'downloads' && <DownloadsTab folder={downloadFolder} onPickFolder={pickFolder} />}
          {tab === 'shortcuts' && <ShortcutsTab />}
          {tab === 'account' && <AccountTab account={account} onLogout={logout} />}
          {tab === 'about' && <AboutTab />}
        </motion.div>
      </div>
    </div>
  )
}


// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
      {children}
    </h2>
  )
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: '1px solid var(--color-separator)' }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
        {description && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ── Appearance ────────────────────────────────────────────────────────────────

function ThemeBtn({
  value, current, label, onChange,
}: { value: Theme; current: Theme; label: string; onChange: (v: Theme) => void }) {
  const active = value === current
  return (
    <button
      onClick={() => onChange(value)}
      className="rounded-md px-3 py-1.5 text-sm transition-colors"
      style={{
        background: active ? 'var(--color-accent)' : 'var(--color-separator)',
        color: active ? '#fff' : 'var(--color-text-primary)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

function AppearanceTab({ theme, onThemeChange }: { theme: Theme; onThemeChange: (t: Theme) => void }) {
  return (
    <div>
      <SectionTitle>Appearance</SectionTitle>
      <Row label="Theme" description="Choose how the app looks">
        <div className="flex gap-1.5">
          <ThemeBtn value="light" current={theme} label="Light" onChange={onThemeChange} />
          <ThemeBtn value="dark" current={theme} label="Dark" onChange={onThemeChange} />
          <ThemeBtn value="system" current={theme} label="System" onChange={onThemeChange} />
        </div>
      </Row>
    </div>
  )
}

// ── Downloads ─────────────────────────────────────────────────────────────────

function DownloadsTab({ folder, onPickFolder }: { folder: string; onPickFolder: () => void }) {
  return (
    <div>
      <SectionTitle>Downloads</SectionTitle>
      <Row label="Default folder" description="Where downloaded artifacts are saved">
        <div className="flex items-center gap-2">
          {folder && (
            <span className="max-w-[180px] truncate text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {folder}
            </span>
          )}
          <button
            onClick={onPickFolder}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors"
            style={{ background: 'var(--color-separator)', color: 'var(--color-text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-accent-subtle)'
              e.currentTarget.style.color = 'var(--color-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-separator)'
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
          >
            <FolderOpen size={13} />
            {folder ? 'Change' : 'Choose folder'}
          </button>
        </div>
      </Row>
    </div>
  )
}

// ── Account ───────────────────────────────────────────────────────────────────

interface AccountInfo {
  display_name?: string | null
  email?: string | null
}

function AccountTab({ account, onLogout }: { account: AccountInfo | null; onLogout: () => void }) {
  return (
    <div>
      <SectionTitle>Account</SectionTitle>
      <Row label="Signed in as" description={account?.email ?? ''}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {account?.display_name ?? account?.email ?? '—'}
        </span>
      </Row>
      <div className="mt-6">
        <button
          onClick={onLogout}
          className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
          style={{ background: 'rgba(255,69,58,0.1)', color: 'var(--color-error)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,69,58,0.18)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,69,58,0.1)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

// ── About ─────────────────────────────────────────────────────────────────────

function AboutTab() {
  return (
    <div>
      <SectionTitle>About</SectionTitle>
      <Row label="NotebookLM Studio" description="Open-source desktop client for Google NotebookLM">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>v0.1.0</span>
      </Row>
      <Row label="Source code" description="View the project on GitHub">
        <button
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-accent)' }}
          onClick={() => invoke('open_url', { url: 'https://github.com' }).catch(() => {})}
        >
          GitHub →
        </button>
      </Row>
    </div>
  )
}
