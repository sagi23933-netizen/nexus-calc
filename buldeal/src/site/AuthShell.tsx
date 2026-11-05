import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Percent, Sparkles } from 'lucide-react';
import { BrandLogo } from '../shared/Brand';

/** Split-screen shell for login / sign-up pages: form + 3D floating deal coupons. */
export function AuthShell({ title, subtitle, children, aside }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <BrandLogo height={44} />
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowRight size={16} /> לאתר
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <h1 className="font-display text-4xl leading-tight text-leaf-900">{title}</h1>
            {subtitle && <p className="mt-2 text-ink-500">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-leaf-900 lg:block">
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(700px 400px at 20% 10%, rgba(163,213,32,.45), transparent 65%), radial-gradient(600px 420px at 90% 100%, rgba(140,63,24,.7), transparent 65%)' }} />
        <div aria-hidden className="pat-dots absolute inset-0 text-white opacity-[0.06]" />
        <div className="perspective relative flex h-full flex-col items-center justify-center px-12">
          <div className="preserve-3d relative h-[340px] w-[300px]" style={{ transform: 'rotateX(14deg) rotateY(18deg)' }}>
            {[
              { bg: 'linear-gradient(150deg,#ff7a18,#c81d25)', t: '40% הנחה', s: 'מגש משפחתי', e: '🍕', r: -10, x: -70, y: 30, z: 0 },
              { bg: 'linear-gradient(150deg,#f7b2c4,#c9748f)', t: '35% הנחה', s: 'מניקור ג׳ל', e: '💅', r: 8, x: 70, y: -20, z: 60 },
              { bg: 'linear-gradient(150deg,#1e5c2e,#8cc10a)', t: 'דיל בזק!', s: 'רק היום עד 22:00', e: '🔥', r: -2, x: 0, y: 60, z: 120 },
            ].map((c, i) => (
              <div
                key={i}
                className="absolute inset-0 animate-floaty rounded-[30px] p-6 text-white shadow-deep"
                style={{ background: c.bg, transform: `translate3d(${c.x}px, ${c.y}px, ${c.z}px) rotate(${c.r}deg)`, animationDelay: `${i * 0.7}s` }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-white/25 px-2 py-1 text-xs font-black backdrop-blur">מבצע בזק</span>
                  <Percent size={28} strokeWidth={3} />
                </div>
                <div className="mt-10 text-6xl">{c.e}</div>
                <div className="mt-6 font-display text-4xl">{c.t}</div>
                <div className="mt-1 font-bold opacity-90">{c.s}</div>
              </div>
            ))}
          </div>
          <div className="relative mt-24 max-w-md text-center text-white">
            {aside ?? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-lime-300 ring-1 ring-white/15">
                  <Sparkles size={15} /> כרטיס מעוצב ב-AI לכל דיל
                </div>
                <p className="mt-4 text-2xl font-bold leading-snug">מפרסמים דיל בזק, והלקוחות בעיר מגיעים — בחיוג או בניווט ב-Waze.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
