import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Ban, CalendarClock, CalendarPlus, Coins, Copy, CreditCard, Eye, KeyRound, LifeBuoy, Minus, MousePointerClick, Plus, Save, Send, Star, Trash2, Wand2,
} from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { date, dateTime, daysLeft, money, END_REASON, BLOCK_REASON, relative, TOKEN_TYPE } from '../../lib/format';
import type { BusinessInfo, Deal, HistoryItem, Payment, Ticket, TokenTx } from '../../lib/types';
import { Button, Confirm, Empty, Field, Input, Modal, StatusBadge, Switch, Textarea, cx } from '../../shared/ui';
import { DealCard } from '../../shared/DealCard';
import { useToast } from '../../shared/Toast';
import { Panel } from '../kit';
import { FeedbackChip, KeyVal, TableWrap, copyText, useLookups, DSelect } from './shared';

export interface BizOwner {
  id: number;
  name: string;
  email: string;
  phone: string;
  last_login_at: string | null;
  is_active: number;
  must_change_password: number;
  created_at: string;
}

export interface BizDetail {
  business: BusinessInfo & { admin_notes: string };
  owner: BizOwner;
  deals: Deal[];
  history: HistoryItem[];
  payments: Payment[];
  tokens: TokenTx[];
  tickets: Ticket[];
  stats: { deals: number; views: number; clicks: number; helped: number | null; answered: number | null; revenue: number };
}

const ErrorLine = ({ error }: { error: string | null }) =>
  error ? <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 ring-1 ring-red-400/20">{error}</p> : null;

// ---------------- details ----------------
export function DetailsTab({ data, onSaved }: { data: BizDetail; onSaved: () => void }) {
  const toast = useToast();
  const { categories, cities, packages } = useLookups();
  const b = data.business;
  const [f, setF] = useState({
    name: b.name,
    slug: b.slug,
    description: b.description,
    phone: b.phone,
    whatsapp: b.whatsapp,
    address: b.address,
    waze_url: b.waze_url,
    website: b.website,
    instagram: b.instagram,
    category_id: String(b.category?.id ?? ''),
    city_id: String(b.city?.id ?? ''),
    package_id: String(b.package?.id ?? ''),
    admin_notes: b.admin_notes || '',
    ownerName: data.owner.name,
    ownerEmail: data.owner.email,
    ownerPhone: data.owner.phone,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/admin/businesses/${b.id}`, {
        ...f,
        category_id: Number(f.category_id) || null,
        city_id: Number(f.city_id) || null,
        package_id: Number(f.package_id) || null,
      });
      toast('פרטי העסק נשמרו');
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Panel title="פרטי העסק" className="xl:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="שם העסק" dark required>
            <Input dark value={f.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="כתובת בעמוד (slug)" dark hint={`/b/${f.slug}`}>
            <Input dark dir="ltr" className="text-left" value={f.slug} onChange={(e) => set('slug', e.target.value)} />
          </Field>
          <Field label="קטגוריה" dark>
            <DSelect value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </DSelect>
          </Field>
          <Field label="עיר" dark>
            <DSelect value={f.city_id} onChange={(e) => set('city_id', e.target.value)}>
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </DSelect>
          </Field>
          <Field label="טלפון העסק" dark required>
            <Input dark dir="ltr" className="text-left" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="וואטסאפ" dark>
            <Input dark dir="ltr" className="text-left" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
          </Field>
          <Field label="כתובת" dark className="sm:col-span-2">
            <Input dark value={f.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="קישור Waze" dark hint="ריק = יחושב אוטומטית מהכתובת">
            <Input dark dir="ltr" className="text-left" value={f.waze_url} onChange={(e) => set('waze_url', e.target.value)} placeholder="https://waze.com/ul?..." />
          </Field>
          <Field label="אתר אינטרנט" dark>
            <Input dark dir="ltr" className="text-left" value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
          </Field>
          <Field label="אינסטגרם" dark>
            <Input dark dir="ltr" className="text-left" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} />
          </Field>
          <Field label="חבילה משויכת" dark>
            <DSelect value={f.package_id} onChange={(e) => set('package_id', e.target.value)}>
              <option value="">ללא</option>
              {packages
                .filter((p) => p.kind === 'subscription')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · ₪{p.price}
                  </option>
                ))}
            </DSelect>
          </Field>
          <Field label="תיאור" dark className="sm:col-span-2">
            <Textarea dark rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="בעל העסק">
          <div className="space-y-4">
            <Field label="שם" dark>
              <Input dark value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
            </Field>
            <Field label="אימייל (שם משתמש)" dark>
              <Input dark dir="ltr" className="text-left" value={f.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} />
            </Field>
            <Field label="טלפון" dark>
              <Input dark dir="ltr" className="text-left" value={f.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <KeyVal label="כניסה אחרונה">{data.owner.last_login_at ? relative(data.owner.last_login_at) : 'אף פעם'}</KeyVal>
              <KeyVal label="נוצר">{date(data.owner.created_at)}</KeyVal>
            </div>
          </div>
        </Panel>
        <Panel title="הערות פנימיות" subtitle="נראות למנהלים בלבד">
          <Textarea dark rows={5} value={f.admin_notes} onChange={(e) => set('admin_notes', e.target.value)} placeholder="היסטוריית שיחות, הסכמים מיוחדים…" />
        </Panel>
      </div>

      <div className="flex items-center justify-end gap-3 xl:col-span-3">
        <ErrorLine error={error} />
        <Button icon={<Save size={16} />} loading={saving} onClick={save}>
          שמירת שינויים
        </Button>
      </div>
    </div>
  );
}

// ---------------- trial & subscription ----------------
const STATUS_OPTIONS = [
  { value: 'active', label: 'פעיל' },
  { value: 'trial', label: 'תקופת ניסיון' },
  { value: 'past_due', label: 'ממתין לתשלום' },
  { value: 'blocked', label: 'חסום' },
  { value: 'suspended', label: 'מושעה' },
];

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SubscriptionTab({ data, onSaved }: { data: BizDetail; onSaved: () => void }) {
  const toast = useToast();
  const b = data.business;
  const [days, setDays] = useState(String(b.trial.days));
  const [endsAt, setEndsAt] = useState(toLocalInput(b.trial.ends_at));
  const [status, setStatus] = useState<string>(b.status);
  const [reason, setReason] = useState('');
  const [activeDays, setActiveDays] = useState('30');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDays(String(b.trial.days));
    setEndsAt(toLocalInput(b.trial.ends_at));
    setStatus(b.status);
  }, [b.trial.days, b.trial.ends_at, b.status]);

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast(msg);
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const setTrialDays = (n: number) => run('days', () => api.post(`/admin/businesses/${b.id}/trial`, { days: n }), `תקופת הניסיון עודכנה ל-${n} ימים`);
  const left = daysLeft(b.trial.ends_at);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="תקופת ניסיון" subtitle={b.source === 'admin' ? 'עסק שנפתח ע״י מנהל — ברירת מחדל 30 יום' : 'נרשם דרך האתר — ברירת מחדל 3 ימים, טוקן אחד ליום'} actions={<CalendarClock size={18} className="text-ink-400" />}>
        <div className="grid grid-cols-3 gap-3">
          <KeyVal label="התחילה">{date(b.trial.started_at)}</KeyVal>
          <KeyVal label="מסתיימת">{dateTime(b.trial.ends_at)}</KeyVal>
          <KeyVal label="נותרו">{b.status === 'trial' ? `${left} ימים` : '—'}</KeyVal>
        </div>
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="אורך תקופת הניסיון (ימים מתחילתה)" dark className="w-56">
              <Input dark type="number" min={0} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
            <Button variant="leaf" loading={busy === 'days'} onClick={() => setTrialDays(Number(days))}>
              עדכון
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[3, 7, 14, 30].map((n) => (
              <button key={n} onClick={() => setTrialDays(b.trial.days + n)} className="chip bg-white/5 px-3 py-1.5 text-ink-200 ring-1 ring-white/10 transition hover:bg-lime-400/15 hover:text-lime-200">
                <CalendarPlus size={13} /> +{n} ימים
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-white/5 pt-4">
            <Field label="או תאריך סיום מדויק" dark className="w-64">
              <Input dark type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
            <Button variant="a-outline" loading={busy === 'date'} onClick={() => run('date', () => api.post(`/admin/businesses/${b.id}/trial`, { endsAt: new Date(endsAt).toISOString() }), 'תאריך הסיום עודכן')}>
              קביעת תאריך
            </Button>
          </div>
          <p className="text-xs text-ink-500">הארכת ניסיון לעסק חסום שטרם שילם תחזיר אותו אוטומטית לתקופת ניסיון.</p>
        </div>
      </Panel>

      <Panel title="סטטוס החשבון" actions={<StatusBadge status={b.status} dark />}>
        {b.blocked_reason && ['blocked', 'suspended'].includes(b.status) && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/20">
            <Ban size={15} /> סיבת חסימה: {BLOCK_REASON[b.blocked_reason] || b.blocked_reason}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="סטטוס חדש" dark>
            <DSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </DSelect>
          </Field>
          {status === 'active' && !b.period_end ? (
            <Field label="הפעלה ידנית לכמה ימים" dark hint="ללא חיוב — למשל תשלום שהתקבל בהעברה">
              <Input dark type="number" min={1} value={activeDays} onChange={(e) => setActiveDays(e.target.value)} />
            </Field>
          ) : (
            <Field label="סיבה / הערה" dark hint="תוצג לעסק בהתראה">
              <Input dark value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
        </div>
        {['blocked', 'suspended'].includes(status) && <p className="mt-3 text-xs text-amber-300">שימו לב: חסימה מורידה מיידית את כל הדילים הפעילים של העסק מהאתר.</p>}
        <div className="mt-4 flex justify-end">
          <Button
            variant={['blocked', 'suspended'].includes(status) ? 'danger' : 'lime'}
            disabled={status === b.status}
            loading={busy === 'status'}
            onClick={() => run('status', () => api.post(`/admin/businesses/${b.id}/status`, { status, reason, days: Number(activeDays) }), 'הסטטוס עודכן')}
          >
            עדכון סטטוס
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/5 pt-5">
          <KeyVal label="חבילה">{b.package?.name || 'לא נבחרה'}</KeyVal>
          <KeyVal label="מחיר">{b.package ? money(b.package.price) : '—'}</KeyVal>
          <KeyVal label="תקופה נוכחית">{b.period_start ? `${date(b.period_start)} — ${date(b.period_end)}` : '—'}</KeyVal>
          <KeyVal label="חידוש אוטומטי">{b.auto_renew ? 'פעיל' : 'כבוי'}</KeyVal>
          <KeyVal label="אמצעי תשלום" className="col-span-2">
            {b.card ? (
              <span className="flex items-center gap-2">
                <CreditCard size={15} className="text-ink-400" /> {b.card.brand} •••• {b.card.last4} · {b.card.exp}
              </span>
            ) : (
              'לא שמור'
            )}
          </KeyVal>
        </div>
      </Panel>
      <div className="xl:col-span-2">
        <ErrorLine error={error} />
      </div>
    </div>
  );
}

// ---------------- tokens ----------------
export function TokensTab({ data, onSaved }: { data: BizDetail; onSaved: () => void }) {
  const toast = useToast();
  const b = data.business;
  const [amount, setAmount] = useState(5);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/businesses/${b.id}/tokens`, { amount, note });
      toast(amount > 0 ? `נוספו ${amount} טוקנים` : `הופחתו ${-amount} טוקנים`);
      setNote('');
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6">
        <Panel title="יתרת טוקנים">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-amber-300/20 to-amber-600/10 p-4 ring-1 ring-amber-300/20">
              <div className="text-xs text-amber-200/80">יתרה</div>
              <div className="mt-1 flex items-center gap-2 text-3xl font-black text-white">
                <Coins size={24} className="text-amber-300" />
                {b.tokens.balance}
              </div>
            </div>
            <div className="rounded-2xl bg-sky-400/10 p-4 ring-1 ring-sky-300/20">
              <div className="text-xs text-sky-200/80">טוקן יומי (ניסיון)</div>
              <div className="mt-1 text-3xl font-black text-white">{b.tokens.daily}</div>
            </div>
          </div>
        </Panel>
        <Panel title="הוספה / הפחתה ידנית">
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setAmount((a) => a - 1)} className="btn-icon h-12 w-12 rounded-2xl bg-white/5 text-white hover:bg-white/10" aria-label="הפחתה">
              <Minus size={20} />
            </button>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.trunc(Number(e.target.value)) || 0)}
              className={cx('a-input w-28 text-center text-3xl font-black', amount < 0 ? '!text-red-300' : '!text-lime-300')}
            />
            <button onClick={() => setAmount((a) => a + 1)} className="btn-icon h-12 w-12 rounded-2xl bg-white/5 text-white hover:bg-white/10" aria-label="הוספה">
              <Plus size={20} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[1, 5, 10, 30, -1, -5].map((n) => (
              <button key={n} onClick={() => setAmount(n)} className={cx('chip px-3 py-1 ring-1', n > 0 ? 'bg-lime-400/10 text-lime-300 ring-lime-400/20' : 'bg-red-400/10 text-red-300 ring-red-400/20')}>
                {n > 0 ? `+${n}` : n}
              </button>
            ))}
          </div>
          <Field label="הערה (תוצג לעסק)" dark className="mt-4">
            <Input dark value={note} onChange={(e) => setNote(e.target.value)} placeholder="לדוגמה: מתנת הצטרפות" />
          </Field>
          <div className="mt-4 space-y-3">
            <ErrorLine error={error} />
            <Button className="w-full" variant={amount < 0 ? 'danger' : 'lime'} disabled={!amount} loading={busy} onClick={submit}>
              {amount >= 0 ? `הוספת ${amount} טוקנים` : `הפחתת ${-amount} טוקנים`}
            </Button>
          </div>
        </Panel>
      </div>
      <Panel title="תנועות טוקנים" subtitle="50 התנועות האחרונות" className="xl:col-span-2" padded={false}>
        {data.tokens.length === 0 ? (
          <Empty dark icon={<Coins size={24} />} title="אין תנועות עדיין" />
        ) : (
          <TableWrap>
            <table className="a-table">
              <thead>
                <tr>
                  <th>מועד</th>
                  <th>סוג</th>
                  <th>הערה</th>
                  <th>כמות</th>
                  <th>יתרה אחרי</th>
                </tr>
              </thead>
              <tbody>
                {data.tokens.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-ink-400">{dateTime(t.created_at)}</td>
                    <td className="text-ink-200">
                      {TOKEN_TYPE[t.type] || t.type}
                      {t.pool === 'daily' && <span className="mr-1 text-[11px] text-sky-300">(יומי)</span>}
                    </td>
                    <td className="max-w-[260px] truncate text-ink-400">{t.note}</td>
                    <td className={cx('font-bold tabular-nums', t.amount > 0 ? 'text-lime-300' : 'text-red-300')} dir="ltr" style={{ textAlign: 'right' }}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </td>
                    <td className="tabular-nums text-ink-200">{t.balance_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}

// ---------------- deals ----------------
export function DealActions({ deal, onChanged, compact }: { deal: Deal; onChanged: () => void; compact?: boolean }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [hours, setHours] = useState(String(deal.duration_hours));

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast(msg);
      onChanged();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className={cx('flex flex-wrap gap-1.5', compact ? '' : 'mt-3 justify-center')}>
        <Button size="sm" variant="a-outline" icon={<Star size={14} className={deal.featured ? 'fill-amber-300 text-amber-300' : ''} />} loading={busy === 'feature'} onClick={() => run('feature', () => api.post(`/admin/deals/${deal.id}/feature`), deal.featured ? 'הקידום הוסר' : 'הדיל מקודם')}>
          {deal.featured ? 'ביטול קידום' : 'קידום'}
        </Button>
        <Button size="sm" variant="a-outline" icon={<Wand2 size={14} />} loading={busy === 'redesign'} onClick={() => run('redesign', () => api.post(`/admin/deals/${deal.id}/redesign`), 'הכרטיס עוצב מחדש')}>
          עיצוב מחדש
        </Button>
        <Button size="sm" variant="a-outline" icon={<CalendarClock size={14} />} onClick={() => setHoursOpen(true)}>
          משך
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
          הסרה
        </Button>
      </div>
      <Confirm
        dark
        danger
        open={confirm}
        onClose={() => setConfirm(false)}
        title="הסרת הדיל מהאתר"
        confirmText="הסרה"
        loading={busy === 'remove'}
        onConfirm={() =>
          run('remove', () => api.del(`/admin/deals/${deal.id}`, { reason }), 'הדיל הוסר מהאתר').then(() => setConfirm(false))
        }
        body={
          <div className="space-y-3">
            <p>
              הדיל <b className="text-white">{deal.title}</b> של {deal.business.name} יוסר מיידית, והעסק יקבל התראה.
            </p>
            <Field label="סיבה (לתיעוד)" dark>
              <Input dark value={reason} onChange={(e) => setReason(e.target.value)} placeholder="לדוגמה: תוכן לא הולם" />
            </Field>
          </div>
        }
      />
      <Modal
        dark
        size="sm"
        open={hoursOpen}
        onClose={() => setHoursOpen(false)}
        title="שינוי משך הדיל"
        footer={
          <>
            <Button variant="a-ghost" onClick={() => setHoursOpen(false)}>
              ביטול
            </Button>
            <Button
              loading={busy === 'hours'}
              onClick={() => run('hours', () => api.put(`/admin/deals/${deal.id}/expiry`, { hours: Number(hours) }), 'משך הדיל עודכן').then(() => setHoursOpen(false))}
            >
              שמירה
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-400">המשך נמדד מתחילת הדיל ({dateTime(deal.starts_at)}). מינימום שעה, מקסימום 48 שעות.</p>
        <Field label="שעות" dark>
          <Input dark type="number" min={1} max={48} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 3, 6, 12, 24, 48].map((h) => (
            <button key={h} onClick={() => setHours(String(h))} className={cx('chip px-3 py-1 ring-1', Number(hours) === h ? 'bg-lime-400 text-leaf-950 ring-lime-300' : 'bg-white/5 text-ink-200 ring-white/10')}>
              {h} ש׳
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export function HistoryTable({ items, showBusiness }: { items: HistoryItem[]; showBusiness?: boolean }) {
  if (!items.length) return <Empty dark icon={<CalendarClock size={24} />} title="אין דילים שהסתיימו" />;
  return (
    <TableWrap>
      <table className="a-table min-w-[860px]">
        <thead>
          <tr>
            <th>דיל</th>
            {showBusiness && <th>עסק</th>}
            <th>מחיר</th>
            <th>זמן</th>
            <th>סיום</th>
            <th>צפיות · לחיצות</th>
            <th>משוב</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h) => (
            <tr key={h.id}>
              <td className="max-w-[240px]">
                <div className="truncate font-semibold text-white">{h.title}</div>
                <div className="text-xs text-ink-500">{h.duration_hours} שעות</div>
              </td>
              {showBusiness && (
                <td>
                  <Link to={`/admin/businesses/${h.business_id}`} className="text-ink-200 hover:text-lime-300">
                    {h.business}
                  </Link>
                  <div className="text-xs text-ink-500">{[h.category, h.city].filter(Boolean).join(' · ')}</div>
                </td>
              )}
              <td className="whitespace-nowrap">
                <s className="text-xs text-ink-500">{money(h.original_price)}</s> <b className="text-white">{money(h.final_price)}</b>
                <div className="text-xs text-lime-300">{Math.round(h.discount_percent)}% הנחה</div>
              </td>
              <td className="whitespace-nowrap text-xs text-ink-400">
                {dateTime(h.started_at)}
                <br />
                עד {dateTime(h.ended_at)}
              </td>
              <td className="text-xs text-ink-300">{END_REASON[h.end_reason] || h.end_reason}</td>
              <td className="whitespace-nowrap text-ink-200">
                <Eye size={13} className="inline text-ink-500" /> {h.views} · <MousePointerClick size={13} className="inline text-ink-500" /> {h.clicks_phone + h.clicks_waze}
              </td>
              <td>
                <FeedbackChip value={h.feedback} customers={h.feedback_customers} />
                {h.feedback_note && <div className="mt-1 max-w-[200px] truncate text-[11px] text-ink-500">“{h.feedback_note}”</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export function DealsTab({ data, onSaved }: { data: BizDetail; onSaved: () => void }) {
  return (
    <div className="space-y-6">
      <Panel title="דילים באוויר" subtitle={`${data.deals.length} דילים פעילים / מתוזמנים`}>
        {data.deals.length === 0 ? (
          <Empty dark title="אין דילים פעילים" text="כשהעסק יפרסם דיל הוא יופיע כאן" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.deals.map((d) => (
              <div key={d.id}>
                {d.status === 'scheduled' && (
                  <div className="mb-2 text-center">
                    <StatusBadge status="scheduled" dark />
                  </div>
                )}
                <DealCard deal={d} preview showStats />
                <DealActions deal={d} onChanged={onSaved} />
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="היסטוריית דילים ומשוב" subtitle={`${data.stats.deals} דילים הסתיימו · ${data.stats.helped ?? 0} דיווחו שהפרסום עזר`} padded={false}>
        <HistoryTable items={data.history} />
      </Panel>
    </div>
  );
}

// ---------------- payments ----------------
export function PaymentsTable({ items, showBusiness, onRefund }: { items: Payment[]; showBusiness?: boolean; onRefund?: (p: Payment) => void }) {
  if (!items.length) return <Empty dark icon={<CreditCard size={24} />} title="אין תשלומים" />;
  const kind = { subscription: 'מנוי', renewal: 'חידוש', tokens: 'טוקנים' };
  return (
    <TableWrap>
      <table className="a-table min-w-[820px]">
        <thead>
          <tr>
            <th>חשבונית</th>
            <th>מועד</th>
            {showBusiness && <th>עסק</th>}
            <th>תיאור</th>
            <th>סוג</th>
            <th>סכום</th>
            <th>כרטיס</th>
            <th>סטטוס</th>
            {onRefund && <th />}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td className="font-mono text-xs text-ink-300">{p.invoice_number || `#${p.id}`}</td>
              <td className="whitespace-nowrap text-ink-400">{dateTime(p.created_at)}</td>
              {showBusiness && <td className="text-ink-200">{p.business}</td>}
              <td className="max-w-[260px] text-ink-200">
                <div className="truncate">{p.description}</div>
                {p.failure_reason && <div className="text-xs text-red-300">{p.failure_reason}</div>}
              </td>
              <td className="text-ink-300">{kind[p.kind]}</td>
              <td className="font-bold tabular-nums text-white">{money(p.amount)}</td>
              <td className="text-ink-400">{p.card_last4 ? `•••• ${p.card_last4}` : '—'}</td>
              <td>
                <StatusBadge status={p.status} dark />
              </td>
              {onRefund && (
                <td>
                  {p.status === 'paid' && (
                    <Button size="sm" variant="a-ghost" onClick={() => onRefund(p)}>
                      זיכוי
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export function PaymentsTab({ data, onSaved }: { data: BizDetail; onSaved: () => void }) {
  const toast = useToast();
  const [refund, setRefund] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="תשלומים" subtitle={`סה״כ שולם: ${money(data.stats.revenue)}`} padded={false}>
      <PaymentsTable items={data.payments} onRefund={setRefund} />
      <Confirm
        dark
        danger
        open={!!refund}
        onClose={() => setRefund(null)}
        title="זיכוי תשלום"
        confirmText="ביצוע זיכוי"
        loading={busy}
        body={refund && <>לזכות את {refund.invoice_number} על סך {money(refund.amount)}? העסק יקבל התראה.</>}
        onConfirm={async () => {
          if (!refund) return;
          setBusy(true);
          try {
            await api.post(`/admin/payments/${refund.id}/refund`);
            toast('הזיכוי בוצע');
            setRefund(null);
            onSaved();
          } catch (e) {
            toast(errMsg(e), 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </Panel>
  );
}

export function TicketsTab({ data }: { data: BizDetail }) {
  return (
    <Panel title="פניות לתמיכה" padded={false}>
      {data.tickets.length === 0 ? (
        <Empty dark icon={<LifeBuoy size={24} />} title="אין פניות מהעסק" />
      ) : (
        <ul>
          {data.tickets.map((t) => (
            <li key={t.id}>
              <Link to={`/admin/support?ticket=${t.id}`} className="flex items-center gap-3 border-b border-white/5 px-5 py-3.5 transition hover:bg-white/5">
                <LifeBuoy size={18} className="text-ink-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{t.subject}</span>
                  <span className="text-xs text-ink-500">{relative(t.last_message_at)}</span>
                </span>
                {t.unread_admin > 0 && <span className="rounded-full bg-lime-400 px-2 text-xs font-bold text-leaf-950">{t.unread_admin}</span>}
                <StatusBadge status={t.status} dark />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------- actions ----------------
export function ActionsTab({ data, onSaved }: { data: BizDetail; onSaved: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const b = data.business;
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState({ title: '', body: '', email: false });
  const [del, setDel] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetPw = async () => {
    setBusy('pw');
    setError(null);
    try {
      const r = await api.post<{ password: string }>(`/admin/businesses/${b.id}/reset-password`, pw ? { password: pw } : {});
      setNewPw(r.password);
      setPw('');
      toast('הסיסמה אופסה — כל החיבורים הקיימים נותקו');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy('notify');
    setError(null);
    try {
      await api.post(`/admin/businesses/${b.id}/notify`, note);
      toast('ההודעה נשלחה לעסק');
      setNote({ title: '', body: '', email: false });
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('del');
    try {
      await api.del(`/admin/businesses/${b.id}`, { confirm: confirmName });
      toast('העסק נמחק לצמיתות');
      nav('/admin/businesses', { replace: true });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="איפוס סיסמה" actions={<KeyRound size={18} className="text-ink-400" />}>
        <p className="mb-4 text-sm text-ink-400">ריק = תיווצר סיסמה זמנית שתוחלף בכניסה הבאה. כל החיבורים הפעילים של המשתמש ינותקו.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="סיסמה חדשה (אופציונלי)" dark className="min-w-[220px] flex-1">
            <Input dark dir="ltr" className="text-left" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Button variant="wood" loading={busy === 'pw'} onClick={resetPw}>
            איפוס
          </Button>
        </div>
        {newPw && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/30 p-4 ring-1 ring-lime-400/20">
            <div>
              <div className="text-xs text-ink-400">הסיסמה החדשה</div>
              <code className="text-xl font-black tracking-wider text-lime-300" dir="ltr">
                {newPw}
              </code>
            </div>
            <button
              className="btn-icon text-ink-300 hover:bg-white/10"
              onClick={() => {
                copyText(newPw);
                toast('הועתק');
              }}
              aria-label="העתקה"
            >
              <Copy size={18} />
            </button>
          </div>
        )}
      </Panel>

      <Panel title="שליחת הודעה לעסק" actions={<Send size={18} className="text-ink-400" />}>
        <div className="space-y-3">
          <Field label="כותרת" dark>
            <Input dark value={note.title} onChange={(e) => setNote((n) => ({ ...n, title: e.target.value }))} />
          </Field>
          <Field label="תוכן" dark>
            <Textarea dark rows={3} value={note.body} onChange={(e) => setNote((n) => ({ ...n, body: e.target.value }))} />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <Switch dark checked={note.email} onChange={(v) => setNote((n) => ({ ...n, email: v }))} label="גם במייל" />
            <Button icon={<Send size={15} />} disabled={!note.title.trim()} loading={busy === 'notify'} onClick={send}>
              שליחה
            </Button>
          </div>
        </div>
      </Panel>

      <div className="xl:col-span-2">
        <ErrorLine error={error} />
      </div>

      <Panel title="אזור מסוכן" className="!border-red-500/20 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-bold text-red-200">מחיקת העסק לצמיתות</div>
            <p className="text-sm text-ink-400">כל הדילים, ההיסטוריה, התשלומים, הטוקנים והפניות של העסק יימחקו. לא ניתן לשחזר.</p>
          </div>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDel(true)}>
            מחיקת העסק
          </Button>
        </div>
      </Panel>

      <Modal
        dark
        size="sm"
        open={del}
        onClose={() => setDel(false)}
        title="מחיקת עסק לצמיתות"
        footer={
          <>
            <Button variant="a-ghost" onClick={() => setDel(false)}>
              ביטול
            </Button>
            <Button variant="danger" disabled={confirmName !== b.name} loading={busy === 'del'} onClick={remove}>
              מחיקה סופית
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-300">
          לאישור, הקלידו את שם העסק: <b className="text-white">{b.name}</b>
        </p>
        <Input dark value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={b.name} />
      </Modal>
    </div>
  );
}

