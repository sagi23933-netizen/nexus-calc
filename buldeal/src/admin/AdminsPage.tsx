import { useState } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { date, relative } from '../lib/format';
import { Button, Confirm, Empty, Field, Input, Modal, Skeleton, Switch, Tilt } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader } from './kit';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export default function AdminsPage() {
  const toast = useToast();
  const { me } = useAuth();
  const { data, loading, reload } = useApi<{ items: AdminUser[] }>('/admin/admins');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState<AdminUser | null>(null);

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/admin/admins', form);
      toast('המנהל נוסף');
      setAdding(false);
      setForm({ name: '', email: '', phone: '', password: '' });
      reload();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (u: AdminUser, active: boolean) => {
    try {
      await api.put(`/admin/admins/${u.id}`, { name: u.name, phone: u.phone, is_active: active });
      toast(active ? 'המנהל הופעל' : 'המנהל הושבת');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const remove = async () => {
    if (!del) return;
    try {
      await api.del(`/admin/admins/${del.id}`);
      toast('המנהל נמחק');
      setDel(null);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="מנהלים"
        subtitle="משתמשים עם גישת מנהל על למערכת"
        icon={<ShieldCheck size={22} />}
        actions={
          <Button icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>
            מנהל חדש
          </Button>
        }
      />

      {loading && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 !rounded-3xl" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <Empty dark title="אין מנהלים" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((u) => {
            const self = u.id === me.user?.id;
            return (
              <Tilt key={u.id} max={6} style={{ borderRadius: 24 }}>
                <div className="a-card relative h-full overflow-hidden p-5" style={{ transformStyle: 'preserve-3d' }}>
                  <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-lime-400/10 blur-2xl" />
                  <div className="relative flex items-start gap-4" style={{ transform: 'translateZ(25px)' }}>
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-wood-300 to-wood-600 text-xl font-black text-white shadow-3d">{u.name?.[0] || '?'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold text-white">{u.name}</span>
                        {self && <span className="chip bg-lime-400/15 text-lime-300">את/ה</span>}
                      </div>
                      <div className="truncate text-sm text-ink-400" dir="ltr" style={{ textAlign: 'right' }}>
                        {u.email}
                      </div>
                      {u.phone && (
                        <div className="text-xs text-ink-500" dir="ltr" style={{ textAlign: 'right' }}>
                          {u.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
                      <div className="text-ink-500">כניסה אחרונה</div>
                      <div className="font-semibold text-ink-200">{u.last_login_at ? relative(u.last_login_at) : 'אף פעם'}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
                      <div className="text-ink-500">נוצר</div>
                      <div className="font-semibold text-ink-200">{date(u.created_at)}</div>
                    </div>
                  </div>
                  <div className="relative mt-4 flex items-center justify-between">
                    <Switch dark checked={!!u.is_active} disabled={self} onChange={(v) => toggle(u, v)} label={u.is_active ? 'פעיל' : 'מושבת'} />
                    {!self && (
                      <button onClick={() => setDel(u)} className="btn-icon text-red-300 hover:bg-red-500/10" aria-label="מחיקה">
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </div>
              </Tilt>
            );
          })}
        </div>
      )}

      <Modal
        dark
        open={adding}
        onClose={() => setAdding(false)}
        title="הוספת מנהל על"
        footer={
          <>
            <Button variant="a-ghost" onClick={() => setAdding(false)}>
              ביטול
            </Button>
            <Button loading={saving} onClick={add}>
              הוספה
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם מלא" dark required>
            <Input dark value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="טלפון" dark>
            <Input dark dir="ltr" className="text-left" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="אימייל" dark required className="sm:col-span-2">
            <Input dark type="email" dir="ltr" className="text-left" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="סיסמה" dark required hint="לפחות 8 תווים, אותיות ומספרים" className="sm:col-span-2">
            <Input dark type="password" dir="ltr" className="text-left" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
        <p className="mt-4 rounded-xl bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200 ring-1 ring-amber-300/20">למנהל חדש תהיה גישה מלאה לכל המערכת, כולל הגדרות, תשלומים ומפתחות AI.</p>
        {error && <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 ring-1 ring-red-400/20">{error}</p>}
      </Modal>

      <Confirm dark danger open={!!del} onClose={() => setDel(null)} onConfirm={remove} title="מחיקת מנהל" confirmText="מחיקה" body={del && <>למחוק את {del.name} ({del.email})? הגישה שלו תבוטל מיד.</>} />
    </>
  );
}
