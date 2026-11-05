import { useCallback, useRef, useState } from 'react';

interface Hist<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface SetOpts {
  /** Consecutive edits with the same key within 800ms collapse into one undo step (typing, sliders). */
  coalesce?: string;
  /** Apply without recording history (e.g. live drag after a checkpoint). */
  skipHistory?: boolean;
}

/** Undo/redo state container. Updaters stay pure (StrictMode-safe): coalescing is decided before setState. */
export function useUndoable<T>(initial: T) {
  const [h, setH] = useState<Hist<T>>({ past: [], present: initial, future: [] });
  const last = useRef<{ key: string; t: number } | null>(null);

  const set = useCallback((updater: T | ((prev: T) => T), opts: SetOpts = {}) => {
    const now = Date.now();
    const coalesce = !!opts.coalesce && last.current?.key === opts.coalesce && now - last.current.t < 800;
    last.current = opts.coalesce ? { key: opts.coalesce, t: now } : null;
    setH((s) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(s.present) : updater;
      if (next === s.present) return s;
      if (opts.skipHistory || coalesce) return { ...s, present: next, future: opts.skipHistory ? s.future : [] };
      return { past: [...s.past.slice(-100), s.present], present: next, future: [] };
    });
  }, []);

  /** Record the current state as an undo point (call before a skipHistory sequence). */
  const checkpoint = useCallback(() => {
    last.current = null;
    setH((s) => ({ past: [...s.past.slice(-100), s.present], present: s.present, future: [] }));
  }, []);

  const undo = useCallback(() => {
    last.current = null;
    setH((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    last.current = null;
    setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  const reset = useCallback((value: T) => {
    last.current = null;
    setH({ past: [], present: value, future: [] });
  }, []);

  return { state: h.present, set, checkpoint, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
