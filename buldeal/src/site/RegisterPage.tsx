import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Gift, Rocket } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { track } from '../lib/track';
import type { Bootstrap } from '../lib/types';
import { Button, Field, Input, Select } from '../shared/ui';
import { AuthShell } from './AuthShell';

export default function RegisterPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [f, setF] = useState({ businessName: '', ownerName: '', email: '', phone: '', categoryId: '', cityId: '', address: '', password: '', acceptTerms: false });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Bootstrap>('/public/bootstrap').then(setBoot).catch(() => {});
    track('signup_start');
  }, []);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const trialDays = boot?.settings.trial.siteDays ?? 3;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.password.length < 8 || !/\d/.test(f.password)) return setError('הסיסמה חייבת להכיל לפחות 8 תווים, כולל אותיות ומספרים');
    setLoading(true);
    try {
      await api.post('/auth/register', { ...f, categoryId: Number(f.categoryId), cityId: Number(f.cityId) });
      await refresh();
      navigate('/choose-package');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="מצטרפים לבולדיל"
      subtitle={`הרשמה חינם לעסקים — ${trialDays} ימי ניסיון, טוקן פרסום אחד בכל יום. בלי כרטיס אשראי ובלי ח.פ.`}
      aside={
        <div className="space-y-3 text-right">
          {[
            `${trialDays} ימי ניסיון חינם`,
            'פרסום דיל תוך פחות מדקה',
            'עיצוב כרטיס אוטומטי ב-AI לפי סוג העסק',
            'חיוג ישיר וניווט ב-Waze ללקוחות',
          ].map((t) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-lg font-bold ring-1 ring-white/10 backdrop-blur">
              <CheckCircle2 className="shrink-0 text-lime-300" /> {t}
            </div>
          ))}
        </div>
      }
    >
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-gradient-to-l from-lime-100 to-white p-4 ring-1 ring-lime-200">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-lime-600 text-leaf-950 shadow-3d">
          <Gift size={20} />
        </span>
        <p className="text-sm font-semibold text-leaf-800">אחרי ההרשמה תבחרו חבילה שתמשיך אחרי תקופת הניסיון — התשלום רק בסופה, ואפשר להחליף בכל רגע.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="שם העסק" required className="sm:col-span-2">
          <Input value={f.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="לדוגמה: פיצה נפוליטנה" required />
        </Field>
        <Field label="שם מלא" required>
          <Input value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} autoComplete="name" required />
        </Field>
        <Field label="טלפון" required>
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" className="text-right" required />
        </Field>
        <Field label="אימייל" required className="sm:col-span-2">
          <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" dir="ltr" className="text-right" required />
        </Field>
        <Field label="קטגוריה" required>
          <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
            <option value="">בחירה…</option>
            {boot?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="עיר" required>
          <Select value={f.cityId} onChange={(e) => set('cityId', e.target.value)} required>
            <option value="">בחירה…</option>
            {boot?.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="כתובת העסק" hint="משמשת לניווט ב-Waze — אפשר להשלים גם אחר כך" className="sm:col-span-2">
          <Input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="רחוב, מספר, עיר" autoComplete="street-address" />
        </Field>
        <Field label="סיסמה" required hint="לפחות 8 תווים, אותיות ומספרים" className="sm:col-span-2">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" required className="pl-11" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label={show ? 'הסתרת סיסמה' : 'הצגת סיסמה'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-600 sm:col-span-2">
          <input type="checkbox" checked={f.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} className="mt-0.5 h-5 w-5 accent-lime-600" required />
          אני מאשר/ת את תנאי השימוש ומדיניות הפרטיות של בולדיל
        </label>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:col-span-2">{error}</p>}
        <Button type="submit" size="lg" className="w-full sm:col-span-2" loading={loading} icon={<Rocket size={18} />}>
          פתיחת חשבון חינם
        </Button>
      </form>
      <p className="mt-6 text-center text-ink-500">
        כבר רשומים?{' '}
        <Link to="/login" className="font-bold text-leaf-700 hover:underline">
          כניסה
        </Link>
      </p>
    </AuthShell>
  );
}
