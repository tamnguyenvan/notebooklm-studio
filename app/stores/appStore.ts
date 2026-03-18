// Shared tauri-plugin-store instance — single file, all app prefs
import { LazyStore } from '@tauri-apps/plugin-store'

export const appStore = new LazyStore('app-prefs.json', { autoSave: true })
