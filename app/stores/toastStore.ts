import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning' | 'undo'
  undoLabel?: string
  onUndo?: () => void
  duration?: number // ms, default 4000
}

interface ToastStore {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

let _counter = 0

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (toast) => {
    const id = `toast-${++_counter}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    const duration = toast.duration ?? 4000
    setTimeout(() => get().dismiss(id), duration)
    return id
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))
