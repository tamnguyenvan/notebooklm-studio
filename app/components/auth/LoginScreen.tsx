'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import Image from 'next/image'

export function LoginScreen() {
  const { login, loginInProgress, error, setError } = useAuthStore()

  const handleLogin = async () => {
    setError(null)
    await login()
  }

  return (
    <div
      className="flex h-screen w-screen items-center justify-center"
      style={{ background: 'var(--color-app-bg)' }}
    >
      {/* Drag region at top */}
      <div
        className="absolute top-0 left-0 right-0 h-12"
        data-tauri-drag-region
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="flex flex-col items-center gap-6 rounded-2xl p-10 w-[360px]"
        style={{
          background: 'var(--color-elevated)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-accent-subtle)' }}
          >
            <Image
              src="/logo.svg"
              alt="NotebookLM Studio"
              width={40}
              height={40}
              priority
            />
          </div>
          <div className="text-center">
            <h1
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              NotebookLM Studio
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Sign in to access your notebooks
            </p>
          </div>
        </div>

        {/* Status message while waiting */}
        <AnimatePresence mode="wait">
          {loginInProgress && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full rounded-xl px-4 py-3 text-sm text-center"
              style={{
                background: 'var(--color-accent-subtle)',
                color: 'var(--color-accent)',
              }}
            >
              <p className="font-medium">A browser window has opened.</p>
              <p className="mt-0.5 opacity-80">
                Please sign in with your Google account.
              </p>
            </motion.div>
          )}

          {error && !loginInProgress && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full rounded-xl px-4 py-3 text-sm flex items-start gap-2"
              style={{
                background: 'rgba(255, 69, 58, 0.08)',
                color: 'var(--color-error)',
              }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign in button */}
        <button
          onClick={handleLogin}
          disabled={loginInProgress}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: loginInProgress ? 'var(--color-accent-subtle)' : 'var(--color-accent)',
            color: loginInProgress ? 'var(--color-accent)' : '#FFFFFF',
          }}
          onMouseEnter={(e) => {
            if (!loginInProgress)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-hover)'
          }}
          onMouseLeave={(e) => {
            if (!loginInProgress)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent)'
          }}
          onMouseDown={(e) => {
            if (!loginInProgress)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-pressed)'
          }}
          onMouseUp={(e) => {
            if (!loginInProgress)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-hover)'
          }}
        >
          {loginInProgress ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Waiting for sign-in…
            </>
          ) : (
            <>
              {/* Google G icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        {loginInProgress && (
          <p
            className="text-xs text-center"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            The browser window will close automatically after sign-in.
            <br />
            Times out after 5 minutes.
          </p>
        )}
      </motion.div>
    </div>
  )
}
