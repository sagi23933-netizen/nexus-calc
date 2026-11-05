import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Field, Input } from '../shared/ui';
import { AuthShell } from './AuthShell';

export default function LoginPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ role: 'admin' | 'business' }>('/auth/login', { email, password });
      const me = await refresh();
      if (res.role === 'admin') return navigate('/admin');
      const next = params.get('next');
      if (me.business?.needs_package) return navigate('/choose-package');
      navigate(next && next.startsWith('/dashboard') ? next : '/dashboard');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="ברוכים השבים 👋" subtitle="כניסה לממשק העסק שלכם בבולדיל">
      <form onSubmit={submit} className="space-y-4">
        <Field label="אימייל">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="text-right" required />
        </Field>
        <Field label="סיסמה">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-11" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label={show ? 'הסתרת סיסמה' : 'הצגת סיסמה'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-leaf-700 hover:underline">
            שכחתי סיסמה
          </Link>
        </div>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading} icon={<LogIn size={18} />}>
          כניסה
        </Button>
      </form>
      <p className="mt-8 text-center text-ink-500">
        עדיין אין לכם חשבון?{' '}
        <Link to="/register" className="font-bold text-leaf-700 hover:underline">
          הרשמה חינם לעסקים
        </Link>
      </p>
    </AuthShell>
  );
}
