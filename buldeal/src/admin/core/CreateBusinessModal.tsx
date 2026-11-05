import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, KeyRound } from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { Button, Field, Input, Modal, Switch, Textarea } from '../../shared/ui';
import { useToast } from '../../shared/Toast';
import { copyText, useLookups, DSelect } from './shared';

const empty = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  categoryId: '',
  cityId: '',
  address: '',
  description: '',
  packageId: '',
  trialDays: '30',
  initialTokens: '0',
  password: '',
  sendEmail: true,
};

export function CreateBusinessModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const { categories, cities, packages } = useLookups();
  const [f, setF] = useState(empty);
  const [defaultDays, setDefaultDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; tempPassword: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ settings: { trial: { adminDays: number } } }>('/admin/settings')
      .then((d) => {
        setDefaultDays(d.settings.trial.adminDays);
        setF((x) => ({ ...x, trialDays: String(d.settings.trial.adminDays) }));
      })
      .catch(() => {});
  }, [open]);

  const set = (k: keyof typeof empty, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await api.post<{ id: number; tempPassword: string | null }>('/admin/businesses', {
        ...f,
        categoryId: Number(f.categoryId) || null,
        cityId: Number(f.cityId) || null,
        packageId: Number(f.packageId) || null,
        trialDays: Number(f.trialDays),
        initialTokens: Number(f.initialTokens) || 0,
        password: f.password || undefined,
      });
      setCreated(res);
      toast(`העסק "${f.businessName}" נוצר בהצלחה`);
      onCreated();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setF({ ...empty, trialDays: String(defaultDays) });
    setCreated(null);
    setError(null);
    onClose();
  };

  const subs = packages.filter((p) => p.kind === 'subscription' && p.is_active);

  return (
    <Modal
      open={open}
      onClose={close}
      dark
      size="lg"
      title={created ? undefined : 'הקמת עסק חדש'}
      footer={
        created ? undefined : (
          <>
            <Button variant="a-ghost" onClick={close}>
              ביטול
            </Button>
            <Button onClick={submit} loading={saving}>
              יצירת העסק
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-lime-400/15 text-lime-300 shadow-glow">
            <CheckCircle2 size={42} />
          </div>
          <h3 className="text-2xl font-black text-white">העסק הוקם בהצלחה</h3>
          <p className="mt-1 text-ink-400">
            {f.trialDays} ימי ניסיון חינם · {f.email}
          </p>
          {created.tempPassword && (
            <div className="mt-6 w-full max-w-sm rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-300">
                <KeyRound size={14} /> סיסמה זמנית (תוחלף בכניסה הראשונה)
              </div>
              <div className="flex items-center justify-center gap-3">
                <code className="text-2xl font-black tracking-wider text-lime-300" dir="ltr">
                  {created.tempPassword}
                </code>
                <button
                  className="btn-icon text-ink-300 hover:bg-white/10"
                  onClick={() => {
                    copyText(created.tempPassword!);
                    toast('הסיסמה הועתקה');
                  }}
                  aria-label="העתקה"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <Button variant="a-outline" onClick={close}>
              סגירה
            </Button>
            <Button
              onClick={() => {
                const id = created.id;
                close();
                nav(`/admin/businesses/${id}`);
              }}
            >
              לכרטיס העסק
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="שם העסק" dark required>
              <Input dark value={f.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="לדוגמה: פיצה בזק" />
            </Field>
            <Field label="שם בעל העסק" dark required>
              <Input dark value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
            </Field>
            <Field label="אימייל (שם משתמש)" dark required>
              <Input dark type="email" dir="ltr" className="text-left" value={f.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="טלפון" dark required>
              <Input dark type="tel" dir="ltr" className="text-left" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="קטגוריה" dark required>
              <DSelect value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">בחירה…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </DSelect>
            </Field>
            <Field label="עיר" dark required>
              <DSelect value={f.cityId} onChange={(e) => set('cityId', e.target.value)}>
                <option value="">בחירה…</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </DSelect>
            </Field>
            <Field label="כתובת" dark className="sm:col-span-2">
              <Input dark value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="רחוב, מספר, עיר" />
            </Field>
            <Field label="תיאור קצר" dark className="sm:col-span-2">
              <Textarea dark rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>

          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/5">
            <div className="mb-3 text-sm font-bold text-white">תקופת ניסיון וחבילה</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="ימי ניסיון" dark hint={`ברירת מחדל: ${defaultDays} ימים`}>
                <Input dark type="number" min={0} max={3650} value={f.trialDays} onChange={(e) => set('trialDays', e.target.value)} />
              </Field>
              <Field label="חבילה להמשך" dark hint="ניתן לבחור גם בהמשך">
                <DSelect value={f.packageId} onChange={(e) => set('packageId', e.target.value)}>
                  <option value="">ללא</option>
                  {subs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · ₪{p.price}
                    </option>
                  ))}
                </DSelect>
              </Field>
              <Field label="טוקנים התחלתיים" dark hint="בנוסף לטוקן היומי">
                <Input dark type="number" min={0} value={f.initialTokens} onChange={(e) => set('initialTokens', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <Field label="סיסמה (אופציונלי)" dark hint="ריק = תיווצר סיסמה זמנית אוטומטית">
              <Input dark type="text" dir="ltr" className="text-left" value={f.password} onChange={(e) => set('password', e.target.value)} />
            </Field>
            <Switch dark checked={f.sendEmail} onChange={(v) => set('sendEmail', v)} label="שליחת פרטי כניסה במייל" description="נשלח רק אם הוגדר שרת SMTP" />
          </div>
          {error && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 ring-1 ring-red-400/20">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
