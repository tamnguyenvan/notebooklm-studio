import { create } from 'zustand'
import { ipc, ChatMessage, ChatReference } from '../lib/ipc'

let _msgCounter = 0
const uid = () => `msg-${++_msgCounter}-${Date.now()}`

interface ChatStore {
  // messages keyed by notebookId
  messages: Record<string, ChatMessage[]>
  // active conversation_id per notebook
  conversationIds: Record<string, string | undefined>
  loading: Record<string, boolean>
  historyLoaded: Record<string, boolean>

  loadHistory: (notebookId: string) => Promise<void>
  sendMessage: (notebookId: string, text: string) => Promise<void>
  setPersona: (notebookId: string, instructions: string) => Promise<void>
  clearMessages: (notebookId: string) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  conversationIds: {},
  loading: {},
  historyLoaded: {},

  loadHistory: async (notebookId) => {
    if (get().historyLoaded[notebookId]) return
    try {
      const history = await ipc.getChatHistory(notebookId)
      set((s) => ({
        messages: { ...s.messages, [notebookId]: history },
        historyLoaded: { ...s.historyLoaded, [notebookId]: true },
      }))
    } catch {
      // History load failure is non-fatal — start fresh
      set((s) => ({
        messages: { ...s.messages, [notebookId]: [] },
        historyLoaded: { ...s.historyLoaded, [notebookId]: true },
      }))
    }
  },

  sendMessage: async (notebookId, text) => {
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      references: [],
      suggested_followups: [],
    }
    const pendingMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      references: [],
      suggested_followups: [],
      pending: true,
    }

    // Optimistic: append user + pending assistant bubble
    set((s) => ({
      messages: {
        ...s.messages,
        [notebookId]: [...(s.messages[notebookId] ?? []), userMsg, pendingMsg],
      },
      loading: { ...s.loading, [notebookId]: true },
    }))

    try {
      const convId = get().conversationIds[notebookId]
      const result = await ipc.sendMessage(notebookId, text, convId)

      const assistantMsg: ChatMessage = {
        id: pendingMsg.id,
        role: 'assistant',
        content: result.answer,
        references: result.references,
        suggested_followups: result.suggested_followups,
      }

      set((s) => ({
        messages: {
          ...s.messages,
          [notebookId]: (s.messages[notebookId] ?? []).map((m) =>
            m.id === pendingMsg.id ? assistantMsg : m
          ),
        },
        conversationIds: { ...s.conversationIds, [notebookId]: result.conversation_id },
        loading: { ...s.loading, [notebookId]: false },
      }))
    } catch (e) {
      // Replace pending with error bubble
      const errorMsg: ChatMessage = {
        id: pendingMsg.id,
        role: 'assistant',
        content: '',
        references: [],
        suggested_followups: [],
        error: String(e),
      }
      set((s) => ({
        messages: {
          ...s.messages,
          [notebookId]: (s.messages[notebookId] ?? []).map((m) =>
            m.id === pendingMsg.id ? errorMsg : m
          ),
        },
        loading: { ...s.loading, [notebookId]: false },
      }))
    }
  },

  setPersona: async (notebookId, instructions) => {
    await ipc.setPersona(notebookId, instructions)
  },

  clearMessages: (notebookId) => {
    set((s) => ({
      messages: { ...s.messages, [notebookId]: [] },
      conversationIds: { ...s.conversationIds, [notebookId]: undefined },
      historyLoaded: { ...s.historyLoaded, [notebookId]: false },
    }))
  },
}))
