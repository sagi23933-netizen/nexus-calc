import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BrandIcon } from './Brand';
import { Button, Field, Input, cx } from './ui';
import { useToast } from './Toast';

/** Shown instead of the admin/business area while the user still has a temporary password. */
export function ForcePasswordChange({ dark }: { dark?: boolean }) {
  const { me, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = [
    { ok: next.length >= 8, text: 'לפחות 8 תווים' },
    { ok: /[A-Za-z֐-׿]/.test(next) && /\d/.test(next), text: 'אותיות ומספרים' },
    { ok: !!next && next !== current, text: 'שונה מהסיסמה הזמנית' },
    { ok: !!next && next === confirm, text: 'האימות תואם' },
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!rules.every((r) => r.ok)) return setError('הסיסמה החדשה אינה עומדת בכל הדרישות');
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      await refresh();
      toast('הסיסמה עודכנה — ברוכים הבאים!');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cx('flex min-h-screen items-center justify-center px-4 py-10', dark && 'admin-theme')}
      style={dark ? undefined : { background: 'radial-gradient(800px 420px at 50% -10%, rgba(163,213,32,.3), transparent 70%), #fbfaf3' }}
    >
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        style={{ transformPerspective: 1200 }}
        className={cx('w-full max-w-md p-7 sm:p-8', dark ? 'a-card' : 'card-3d')}
      >
        <div className="flex items-center gap-3">
          <BrandIcon size={52} />
          <div>
            <h1 className={cx('text-2xl font-black', dark ? 'text-white' : 'text-leaf-900')}>בחירת סיסמה חדשה</h1>
            <p className={cx('text-sm', dark ? 'text-ink-400' : 'text-ink-500')}>{me.user?.email}</p>
          </div>
        </div>
        <div className={cx('mt-5 flex gap-2.5 rounded-2xl p-3.5 text-sm', dark ? 'bg-lime-400/10 text-lime-200 ring-1 ring-lime-400/20' : 'bg-lime-50 text-leaf-800 ring-1 ring-lime-200')}>
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          זו הכניסה הראשונה עם סיסמה זמנית. כדי להמשיך, בחרו סיסמה אישית חדשה.
        </div>

        <div className="mt-6 space-y-4">
          <Field label="הסיסמה הזמנית" dark={dark}>
            <Input dark={dark} type={show ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="סיסמה חדשה" dark={dark}>
            <div className="relative">
              <Input dark={dark} type={show ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required className="!pl-11" />
              <button type="button" onClick={() => setShow((s) => !s)} className={cx('absolute left-3 top-1/2 -translate-y-1/2', dark ? 'text-ink-400 hover:text-white' : 'text-ink-400 hover:text-ink-700')} aria-label={show ? 'הסתרת סיסמה' : 'הצגת סיסמה'}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <Field label="אימות הסיסמה החדשה" dark={dark}>
            <Input dark={dark} type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </Field>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {rules.map((r) => (
            <li key={r.text} className={cx('flex items-center gap-1.5 font-medium', r.ok ? (dark ? 'text-lime-300' : 'text-lime-700') : dark ? 'text-ink-500' : 'text-ink-400')}>
              <span className={cx('flex h-4 w-4 items-center justify-center rounded-full', r.ok ? 'bg-lime-500 text-leaf-950' : dark ? 'bg-white/10' : 'bg-ink-100')}>{r.ok && <Check size={11} strokeWidth={3} />}</span>
              {r.text}
            </li>
          ))}
        </ul>

        {error && <p className={cx('mt-4 rounded-xl px-3.5 py-2.5 text-sm font-medium', dark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700')}>{error}</p>}

        <Button type="submit" size="lg" className="mt-6 w-full" loading={loading} icon={<KeyRound size={18} />}>
          שמירת הסיסמה והמשך
        </Button>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate(dark ? '/admin/login' : '/login');
          }}
          className={cx('mx-auto mt-4 flex items-center gap-1.5 text-sm', dark ? 'text-ink-400 hover:text-white' : 'text-ink-500 hover:text-ink-800')}
        >
          <LogOut size={15} /> יציאה
        </button>
      </motion.form>
    </div>
  );
}
