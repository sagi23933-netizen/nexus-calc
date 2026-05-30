/**
 * Global app store (zustand).
 *
 * Holds the platform snapshot, the currently focused run id and a small rolling
 * buffer of recent engine events used by the topbar activity indicator. Pages
 * mostly fetch their own data; this store is for cross-cutting shared state.
 */

import { create } from 'zustand'
import { api } from '../api/client'
import type { EngineEvent, PlatformSnapshot, Run } from '@shared/types'

interface AppState {
  snapshot: PlatformSnapshot | null
  activeRunId: string | null
  runs: Run[]
  recentEvents: EngineEvent[]
  connected: boolean

  refreshSnapshot: () => Promise<void>
  refreshRuns: () => Promise<void>
  setActiveRun: (id: string | null) => void
  ingestEvent: (event: EngineEvent) => void
  setConnected: (c: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  snapshot: null,
  activeRunId: null,
  runs: [],
  recentEvents: [],
  connected: false,

  refreshSnapshot: async () => {
    try {
      const snapshot = await api.snapshot()
      set({ snapshot })
    } catch {
      /* transient */
    }
  },

  refreshRuns: async () => {
    try {
      const runs = await api.listRuns()
      set({ runs })
      if (!get().activeRunId && runs.length) set({ activeRunId: runs[0].id })
    } catch {
      /* transient */
    }
  },

  setActiveRun: (id) => set({ activeRunId: id }),

  ingestEvent: (event) => {
    const buf = [event, ...get().recentEvents].slice(0, 60)
    set({ recentEvents: buf })

    // Keep the runs list and snapshot loosely in sync on key transitions.
    if (event.type === 'run.created' || event.type === 'run.completed' || event.type === 'run.updated') {
      const payload = event.payload as Run
      if (payload && payload.id) {
        const runs = get().runs.slice()
        const idx = runs.findIndex((r) => r.id === payload.id)
        if (idx >= 0) runs[idx] = payload
        else runs.unshift(payload)
        set({ runs })
      }
    }
    if (event.type === 'run.completed' || event.type === 'run.created' || event.type === 'deployment.updated') {
      void get().refreshSnapshot()
    }
  },

  setConnected: (connected) => set({ connected }),
}))
