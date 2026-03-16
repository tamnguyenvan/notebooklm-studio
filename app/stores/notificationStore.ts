import { create } from 'zustand'

export type NotificationKind = 'success' | 'error' | 'info' | 'warning'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body?: string
  ts: number       // Date.now()
  read: boolean
  action?: {       // optional CTA
    label: string
    onClick: () => void
  }
}

interface NotificationStore {
  notifications: AppNotification[]
  push: (n: Omit<AppNotification, 'id' | 'ts' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
  unreadCount: () => number
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  push: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: crypto.randomUUID(), ts: Date.now(), read: false },
        ...s.notifications,
      ].slice(0, 50), // cap at 50
    })),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  remove: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clear: () => set({ notifications: [] }),

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}))
