import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Tilt } from '../shared/ui';

export default function AdminLogin() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me.user?.role === 'admin') return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/login', { email, password, role: 'admin' });
      await refresh();
      nav('/admin', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-theme relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* floating 3D decor */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 top-10 h-80 w-80 animate-blob bg-lime-500/15 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-96 w-96 animate-blob bg-wood-500/20 blur-3xl" style={{ animationDelay: '-4s' }} />
        <img src="/icon-192.png" alt="" className="absolute right-[12%] top-[14%] h-24 w-24 rotate-12 animate-floaty opacity-60 blur-[1px]" />
        <img src="/icon-192.png" alt="" className="absolute bottom-[12%] left-[10%] h-16 w-16 -rotate-12 animate-floaty opacity-40" style={{ animationDelay: '-2s' }} />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#bfe6a0 1px,transparent 1px),linear-gradient(90deg,#bfe6a0 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 30, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 160 }} className="relative w-full max-w-md" style={{ transformPerspective: 1200 }}>
        <Tilt max={5} scale={1} style={{ borderRadius: 32 }}>
          <div className="a-card relative overflow-hidden !rounded-[32px] p-8 sm:p-10" style={{ transformStyle: 'preserve-3d' }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-lime-400/10 to-transparent" />
            <div className="relative flex flex-col items-center text-center" style={{ transform: 'translateZ(40px)' }}>
              <img src="/logo.webp" alt="בולדיל" className="h-16 w-auto drop-shadow-[0_10px_20px_rgba(140,193,10,.35)]" />
              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300 ring-1 ring-lime-400/20">
                <ShieldCheck size={14} /> ממשק ניהול מאובטח
              </div>
              <h1 className="mt-4 text-2xl font-black text-white">כניסת מנהל על</h1>
              <p className="mt-1 text-sm text-ink-400">שליטה מלאה בעסקים, בחבילות, במודלי ה-AI ובנתוני האתר</p>
            </div>

            <form onSubmit={submit} className="relative mt-8 space-y-4" style={{ transform: 'translateZ(30px)' }}>
              <Field label="אימייל" dark>
                <div className="relative">
                  <Input dark type="email" required autoComplete="username" dir="ltr" className="!pr-10 text-left" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@buldeal.co.il" />
                  <Mail size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
                </div>
              </Field>
              <Field label="סיסמה" dark>
                <div className="relative">
                  <Input dark type={show ? 'text' : 'password'} required autoComplete="current-password" dir="ltr" className="!px-10 text-left" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  <Lock size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white" aria-label={show ? 'הסתרת סיסמה' : 'הצגת סיסמה'}>
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>
              {error && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 ring-1 ring-red-400/20">{error}</p>}
              <Button type="submit" size="lg" loading={loading} className="w-full">
                כניסה למערכת
              </Button>
            </form>
            <div className="relative mt-6 text-center text-xs text-ink-500">
              <Link to="/" className="hover:text-lime-300">
                חזרה לאתר בולדיל
              </Link>
            </div>
          </div>
        </Tilt>
      </motion.div>
    </div>
  );
}
