// Shared tauri-plugin-store instance — single file, all app prefs
// Guard against SSR (Next.js runs on Node where Tauri APIs don't exist)
import { LazyStore } from '@tauri-apps/plugin-store'

export const appStore = typeof window !== 'undefined'
  ? new LazyStore('app-prefs.json', { autoSave: true })
  : null as unknown as InstanceType<typeof LazyStore>
