import { create } from 'zustand'
import { ipc, ShareStatus, SharePermission } from '../lib/ipc'

interface SharingStore {
  // status keyed by notebookId
  status: Record<string, ShareStatus>
  loading: Record<string, boolean>

  fetchStatus: (notebookId: string) => Promise<void>
  setPublic: (notebookId: string, public_: boolean) => Promise<ShareStatus>
  addUser: (notebookId: string, email: string, permission: SharePermission, notify: boolean, welcomeMessage: string) => Promise<ShareStatus>
  removeUser: (notebookId: string, email: string) => Promise<ShareStatus>
}

export const useSharingStore = create<SharingStore>((set) => ({
  status: {},
  loading: {},

  fetchStatus: async (notebookId) => {
    set((s) => ({ loading: { ...s.loading, [notebookId]: true } }))
    try {
      const status = await ipc.getSharingStatus(notebookId)
      set((s) => ({
        status: { ...s.status, [notebookId]: status },
        loading: { ...s.loading, [notebookId]: false },
      }))
    } catch {
      set((s) => ({ loading: { ...s.loading, [notebookId]: false } }))
    }
  },

  setPublic: async (notebookId, public_) => {
    const status = await ipc.setSharingPublic(notebookId, public_)
    set((s) => ({ status: { ...s.status, [notebookId]: status } }))
    return status
  },

  addUser: async (notebookId, email, permission, notify, welcomeMessage) => {
    const status = await ipc.addSharingUser(notebookId, email, permission, notify, welcomeMessage)
    set((s) => ({ status: { ...s.status, [notebookId]: status } }))
    return status
  },

  removeUser: async (notebookId, email) => {
    const status = await ipc.removeSharingUser(notebookId, email)
    set((s) => ({ status: { ...s.status, [notebookId]: status } }))
    return status
  },
}))
