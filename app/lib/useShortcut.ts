import { useEffect } from 'react'
import { useShortcutStore, ShortcutHandler } from '../stores/shortcutStore'

/**
 * Register a handler for a named shortcut.
 * The handler is active only while the component is mounted.
 *
 * @example
 * useShortcut('new_notebook', () => setModalOpen(true))
 */
export function useShortcut(id: string, handler: ShortcutHandler) {
  const register = useShortcutStore((s) => s.register)
  useEffect(() => {
    return register(id, handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, handler])
}
