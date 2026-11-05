import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Wand2 } from 'lucide-react';

const STEPS = ['מנתח את הקטגוריה של העסק…', 'בוחר פלטת צבעים מושלמת…', 'כותב כותרת שמושכת עין…', 'מוסיף אפקטים ותלת־ממד…', 'מלטש את הפרטים האחרונים…'];
const CARD_COLORS = [
  ['#ff7a18', '#c81d25'],
  ['#1e5c2e', '#8cc10a'],
  ['#7f00ff', '#e100ff'],
  ['#0f2027', '#2c5364'],
  ['#f7b2c4', '#c9748f'],
];

/** Full-screen "AI is designing your card" experience shown while the deal is published. */
export function AiDesigning({ open, title }: { open: boolean; title?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!open) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1300);
    return () => clearInterval(t);
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center overflow-hidden px-6 text-white"
          style={{ background: 'radial-gradient(1000px 600px at 50% 30%, #1e5c2e 0%, #0b2a14 55%, #050f08 100%)' }}
          role="status"
          aria-live="polite"
        >
          {/* starfield */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: 36 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-lime-200"
                style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, width: 2 + (i % 3), height: 2 + (i % 3) }}
                animate={{ opacity: [0.1, 0.9, 0.1], scale: [0.6, 1.3, 0.6] }}
                transition={{ duration: 2 + (i % 5) * 0.4, repeat: Infinity, delay: (i % 7) * 0.3 }}
              />
            ))}
          </div>

          {/* 3D card carousel */}
          <div className="relative h-[300px] w-[220px]" style={{ perspective: 1000 }}>
            <motion.div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
              {CARD_COLORS.map(([a, b], i) => (
                <div
                  key={i}
                  className="absolute inset-0 flex flex-col items-center justify-start rounded-[26px] p-5 shadow-deep"
                  style={{
                    background: `linear-gradient(150deg, ${a}, ${b})`,
                    transform: `rotateY(${(360 / CARD_COLORS.length) * i}deg) translateZ(230px)`,
                    backfaceVisibility: 'hidden',
                    boxShadow: '0 1px 0 rgba(255,255,255,.35) inset, 0 30px 60px -20px rgba(0,0,0,.7)',
                  }}
                >
                  <div className="h-14 w-14 rounded-full bg-white/90 shadow-lg" />
                  <div className="mt-4 h-4 w-32 rounded-full bg-white/70" />
                  <div className="mt-2 h-3 w-24 rounded-full bg-white/45" />
                  <div className="mt-8 flex w-full items-center justify-between">
                    <div className="h-10 w-20 rounded-xl bg-white/80" />
                    <div className="h-14 w-14 rounded-full bg-yellow-300/90" />
                  </div>
                  <div className="mt-auto h-8 w-full rounded-xl bg-black/20" />
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div className="relative mt-24 flex h-16 w-16 items-center justify-center rounded-3xl text-leaf-950 shadow-glow" style={{ background: 'linear-gradient(160deg,#e8ff9a,#8cc10a 60%,#557a0c)' }} animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.08, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <Wand2 size={30} />
          </motion.div>
          <h2 className="mt-5 text-center text-2xl font-black sm:text-3xl">ה-AI מעצב את הכרטיס שלך…</h2>
          {title && <p className="mt-1 max-w-md truncate text-center text-lime-200/80">“{title}”</p>}
          <div className="mt-4 h-7">
            <AnimatePresence mode="wait">
              <motion.p key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-2 text-white/80">
                <Sparkles size={16} className="text-lime-300" /> {STEPS[step]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-5 h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-l from-lime-300 to-lime-500" initial={{ width: '5%' }} animate={{ width: '92%' }} transition={{ duration: 7, ease: 'easeOut' }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Lightweight confetti burst (no dependencies). */
export function Confetti({ fire }: { fire: number }) {
  if (!fire) return null;
  const colors = ['#8cc10a', '#ffe14d', '#ff7a18', '#ffffff', '#3987e5', '#e87ba4'];
  return createPortal(
    <div key={fire} aria-hidden className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
      {Array.from({ length: 70 }).map((_, i) => {
        const x = (i * 47) % 100;
        const drift = ((i * 31) % 40) - 20;
        return (
          <motion.span
            key={i}
            className="absolute top-[-20px] block rounded-sm"
            style={{ left: `${x}%`, width: 8 + (i % 4) * 2, height: 12 + (i % 3) * 4, background: colors[i % colors.length] }}
            initial={{ y: -40, rotate: 0, opacity: 1 }}
            animate={{ y: '110vh', x: drift * 6, rotate: 360 + i * 25, opacity: [1, 1, 0.8, 0] }}
            transition={{ duration: 2.4 + (i % 6) * 0.35, delay: (i % 10) * 0.06, ease: 'easeIn' }}
          />
        );
      })}
    </div>,
    document.body,
  );
}
