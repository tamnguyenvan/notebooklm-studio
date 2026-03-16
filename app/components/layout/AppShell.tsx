'use client'

import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'

export function AppShell() {
  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--color-app-bg)' }}
    >
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content — placeholder until Module 2 */}
        <main
          className="flex flex-1 flex-col items-center justify-center"
          style={{ background: 'var(--color-content-bg)' }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-5xl">📓</span>
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              No notebooks yet
            </h2>
            <p
              className="max-w-xs text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Your notebooks will appear here once you create one or sign in to NotebookLM.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
