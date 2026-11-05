import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: Kind;
  text: string;
}

const Ctx = createContext<{ toast: (text: string, kind?: Kind) => void } | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (text: string, kind: Kind = 'success') => {
      const id = ++seq;
      setItems((l) => [...l.slice(-3), { id, kind, text }]);
      setTimeout(() => remove(id), kind === 'error' ? 6000 : 3800);
    },
    [remove],
  );
  const icon = { success: <CheckCircle2 className="text-lime-400" size={20} />, error: <AlertTriangle className="text-red-400" size={20} />, info: <Info className="text-sky-300" size={20} /> };
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-2 px-4" aria-live="polite">
          <AnimatePresence>
            {items.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-leaf-950/95 px-4 py-3 text-sm font-medium text-white shadow-deep ring-1 ring-white/10 backdrop-blur"
              >
                {icon[t.kind]}
                <span className="flex-1">{t.text}</span>
                <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100" aria-label="סגירה">
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast outside provider');
  return c.toast;
}
