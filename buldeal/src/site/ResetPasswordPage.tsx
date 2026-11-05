import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Button, Field, Input } from '../shared/ui';
import { AuthShell } from './AuthShell';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setError('הסיסמאות אינן תואמות');
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password: pw });
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="סיסמה חדשה" subtitle="בחרו סיסמה חדשה לחשבון">
      {done ? (
        <div className="card-3d p-6 text-center">
          <ShieldCheck size={44} className="mx-auto text-lime-600" />
          <h2 className="mt-3 text-xl font-bold">הסיסמה עודכנה</h2>
          <Link to="/login" className="btn btn-lime mt-5">
            לכניסה
          </Link>
        </div>
      ) : !token ? (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-800">הקישור חסר או שגוי. בקשו קישור חדש במסך "שכחתי סיסמה".</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="סיסמה חדשה" hint="לפחות 8 תווים, אותיות ומספרים">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label="אימות סיסמה">
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
          </Field>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            עדכון סיסמה
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
