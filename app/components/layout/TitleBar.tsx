'use client'

/**
 * TitleBar — 52px, macOS traffic lights + drag region.
 * On Windows/Linux: no traffic lights, 16px left inset.
 */
export function TitleBar() {
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
      {/* macOS traffic lights live at ~12px from left — leave space */}
      {/* App name — centered */}
      <span
        className="absolute left-1/2 -translate-x-1/2 select-none text-sm font-semibold"
        style={{ color: 'var(--color-text-primary)' }}
        data-tauri-drag-region
      >
        NotebookLM Studio
      </span>
    </div>
  )
}
