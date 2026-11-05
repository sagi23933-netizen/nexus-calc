import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3, Bot, CreditCard, Globe, Info, Mail, PlayCircle, Save, Send, Server, Settings, Ticket, Timer, AlertTriangle, RotateCcw, Database,
} from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useApi } from '../lib/hooks';
import { Button, Field, Input, PageLoader, Switch, Textarea, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader, Panel, StatTile } from './kit';
import { DarkSelect } from './parts';

type Values = Record<string, string | number | boolean>;
type AllSettings = Record<string, Values>;

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'bool' | 'textarea' | 'password' | 'select' | 'email';
  hint?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  ltr?: boolean;
  full?: boolean;
  suffix?: string;
}

interface SectionDef {
  id: string;
  label: string;
  icon: ReactNode;
  description: string;
  fields: FieldDef[];
  note?: ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'site',
    label: 'אתר',
    icon: <Globe size={17} />,
    description: 'טקסטים ופרטי קשר שמופיעים באתר הציבורי ובמיילים.',
    fields: [
      { key: 'name', label: 'שם האתר', type: 'text' },
      { key: 'tagline', label: 'סלוגן', type: 'text' },
      { key: 'heroTitle', label: 'כותרת ראשית (Hero)', type: 'text', full: true },
      { key: 'heroSubtitle', label: 'תת־כותרת ראשית', type: 'textarea', full: true },
      { key: 'contactEmail', label: 'אימייל ליצירת קשר', type: 'email', ltr: true },
      { key: 'contactPhone', label: 'טלפון ליצירת קשר', type: 'text', ltr: true },
      { key: 'whatsapp', label: 'וואטסאפ', type: 'text', ltr: true, hint: 'מספר בפורמט 05X-XXXXXXX' },
      { key: 'footerText', label: 'טקסט בכותרת התחתונה', type: 'text' },
      { key: 'announcementEnabled', label: 'הצגת פס הודעה בראש האתר', type: 'bool', full: true },
      { key: 'announcementText', label: 'תוכן פס ההודעה', type: 'text', full: true },
      { key: 'maintenanceMode', label: 'מצב תחזוקה', type: 'bool', full: true, hint: 'מסמן לאתר הציבורי שהוא בתחזוקה' },
    ],
  },
  {
    id: 'trial',
    label: 'תקופת ניסיון',
    icon: <Timer size={17} />,
    description: 'כמה ימי ניסיון מקבלים עסקים, וכמה טוקנים ביום במהלכם.',
    fields: [
      { key: 'siteDays', label: 'ימי ניסיון — הרשמה דרך האתר', type: 'number', min: 0, max: 365, suffix: 'ימים', hint: 'ברירת מחדל: 3 ימים, ללא כרטיס אשראי' },
      { key: 'adminDays', label: 'ימי ניסיון — עסק שהוקם ע״י מנהל', type: 'number', min: 0, max: 3650, suffix: 'ימים', hint: 'ברירת מחדל: 30 יום. אפשר לשנות לכל עסק בנפרד בכרטיס העסק.' },
      { key: 'dailyTokens', label: 'טוקנים ליום בתקופת הניסיון', type: 'number', min: 0, max: 50, suffix: 'טוקנים', hint: 'לא מצטברים — מתאפסים בכל יום' },
      { key: 'warnHoursBefore', label: 'התראה לפני סיום הניסיון', type: 'number', min: 1, max: 168, suffix: 'שעות', hint: 'ברירת מחדל: 24 שעות ("מחר מסתיימת תקופת הניסיון")' },
    ],
    note: 'בתום הניסיון ללא תשלום החשבון נחסם מיד והדילים הפעילים יורדים מהאתר.',
  },
  {
    id: 'deals',
    label: 'דילים',
    icon: <Ticket size={17} />,
    description: 'כללי פרסום הדילים באתר.',
    fields: [
      { key: 'minHours', label: 'משך מינימלי לדיל', type: 'number', min: 1, max: 48, suffix: 'שעות', hint: 'לפחות שעה אחת' },
      { key: 'maxHours', label: 'משך מקסימלי לדיל', type: 'number', min: 1, max: 48, suffix: 'שעות', hint: 'עד 48 שעות — לאחר מכן הדיל נמחק אוטומטית' },
      { key: 'defaultHours', label: 'משך ברירת מחדל', type: 'number', min: 1, max: 48, suffix: 'שעות' },
      { key: 'freeRedesigns', label: 'עיצובים חוזרים חינם לכל דיל', type: 'number', min: 0, max: 10 },
      { key: 'maxActivePerBusiness', label: 'מקסימום דילים פעילים לעסק', type: 'number', min: 1, max: 100 },
      { key: 'maxDiscount', label: 'אחוז הנחה מקסימלי', type: 'number', min: 1, max: 99, suffix: '%' },
      { key: 'requireImage', label: 'חובה להעלות תמונה לכל דיל', type: 'bool', full: true },
    ],
  },
  {
    id: 'billing',
    label: 'תשלומים וסליקה',
    icon: <CreditCard size={17} />,
    description: 'ספק הסליקה, מע״מ, חשבוניות וחידושי מנוי.',
    fields: [
      { key: 'provider', label: 'ספק סליקה', type: 'select', options: [{ value: 'demo', label: 'מצב הדגמה (ללא חיוב אמיתי)' }] },
      { key: 'currency', label: 'מטבע', type: 'select', options: [{ value: 'ILS', label: '₪ שקל חדש' }] },
      { key: 'vatPercent', label: 'מע״מ', type: 'number', min: 0, max: 50, step: 0.5, suffix: '%' },
      { key: 'pricesIncludeVat', label: 'המחירים כוללים מע״מ', type: 'bool' },
      { key: 'invoicePrefix', label: 'קידומת מספר חשבונית', type: 'text', ltr: true },
      { key: 'graceDays', label: 'ימי חסד לאחר חיוב שנכשל', type: 'number', min: 0, max: 30, suffix: 'ימים' },
      { key: 'renewalWarnDays', label: 'תזכורת לפני חידוש', type: 'number', min: 0, max: 30, suffix: 'ימים' },
      { key: 'terminalId', label: 'מספר מסוף', type: 'text', ltr: true },
      { key: 'apiUser', label: 'משתמש API', type: 'text', ltr: true },
      { key: 'apiKey', label: 'מפתח API', type: 'password', ltr: true, hint: 'נשמר מוסתר; השאירו ללא שינוי כדי לא לעדכן' },
    ],
    note: (
      <>
        במצב <b>הדגמה</b> כל כרטיס תקין מאושר (כרטיס שמסתיים ב-0002 נדחה) ולא מתבצע חיוב אמיתי. כדי לסלוק בפועל יש לחבר ספק סליקה ישראלי (Tranzila, Cardcom, Meshulam, Pelecard וכד׳) — חיבור כזה דורש פיתוח של מתאם בצד השרת לפי ממשק הספק, ואז הוא יופיע ברשימה.
      </>
    ),
  },
  {
    id: 'email',
    label: 'אימייל (SMTP)',
    icon: <Mail size={17} />,
    description: 'שליחת מיילים: ברוכים הבאים, סיום ניסיון, חיובים, איפוס סיסמה.',
    fields: [
      { key: 'enabled', label: 'שליחת מיילים פעילה', type: 'bool', full: true },
      { key: 'host', label: 'שרת SMTP', type: 'text', ltr: true },
      { key: 'port', label: 'פורט', type: 'number', min: 1, max: 65535 },
      { key: 'secure', label: 'חיבור מאובטח (SSL/TLS)', type: 'bool', hint: 'בדרך כלל פורט 465' },
      { key: 'user', label: 'שם משתמש', type: 'text', ltr: true },
      { key: 'pass', label: 'סיסמה', type: 'password', ltr: true },
      { key: 'from', label: 'שולח (From)', type: 'text', full: true, hint: 'למשל: בולדיל <no-reply@buldeal.co.il>' },
    ],
    note: 'כשהמייל כבוי, בקשות איפוס סיסמה נפתחות כפנייה בתיבת התמיכה כדי שתוכלו לאפס ידנית.',
  },
  {
    id: 'ai',
    label: 'עיצוב AI',
    icon: <Bot size={17} />,
    description: 'הגדרות כלליות לעיצוב כרטיסים. בחירת מודל ומפתח — במסך ״מודלי AI״.',
    fields: [
      { key: 'enabled', label: 'עיצוב AI פעיל', type: 'bool', full: true },
      { key: 'fallbackToBuiltin', label: 'גיבוי למעצב המובנה כשה-AI נכשל', type: 'bool', full: true },
      { key: 'timeoutMs', label: 'זמן המתנה מקסימלי', type: 'number', min: 5000, max: 120000, step: 1000, suffix: 'ms' },
    ],
  },
  {
    id: 'analytics',
    label: 'אנליטיקס',
    icon: <BarChart3 size={17} />,
    description: 'מעקב כניסות אנונימי לאתר.',
    fields: [
      { key: 'enabled', label: 'מעקב כניסות פעיל', type: 'bool', full: true },
      { key: 'retentionDays', label: 'שמירת נתונים', type: 'number', min: 30, max: 3650, suffix: 'ימים', hint: 'אירועים ישנים נמחקים אוטומטית' },
    ],
  },
];

const SYSTEM = { id: 'system', label: 'מערכת', icon: <Server size={17} /> };

export default function SettingsPage() {
  const toast = useToast();
  const { data, loading, setData } = useApi<{ settings: AllSettings }>('/admin/settings');
  const [active, setActive] = useState('site');
  const [drafts, setDrafts] = useState<AllSettings>({});
  const [saving, setSaving] = useState(false);

  const current = data?.settings ?? {};
  const section = SECTIONS.find((s) => s.id === active);
  const values: Values = { ...(current[active] || {}), ...(drafts[active] || {}) };
  const dirtyIds = useMemo(
    () => Object.keys(drafts).filter((id) => Object.entries(drafts[id] || {}).some(([k, v]) => current[id]?.[k] !== v)),
    [drafts, current],
  );
  const dirty = dirtyIds.includes(active);

  useEffect(() => {
    if (!dirtyIds.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirtyIds.length]);

  const setVal = (k: string, v: string | number | boolean) => setDrafts((d) => ({ ...d, [active]: { ...(d[active] || {}), [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put<{ settings: AllSettings }>(`/admin/settings/${active}`, drafts[active] || {});
      setData(res);
      setDrafts((d) => {
        const n = { ...d };
        delete n[active];
        return n;
      });
      toast('ההגדרות נשמרו');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const discard = () =>
    setDrafts((d) => {
      const n = { ...d };
      delete n[active];
      return n;
    });

  if (loading && !data) return <PageLoader dark />;

  const nav = [...SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon })), SYSTEM];

  return (
    <div>
      <PageHeader title="הגדרות מערכת" subtitle="כל הפרמטרים של בולדיל במקום אחד" icon={<Settings size={22} />} />
      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav className="a-card flex gap-1 overflow-x-auto p-2 scrollbar-none lg:sticky lg:top-4 lg:flex-col lg:self-start">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setActive(n.id)}
              className={cx(
                'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-right text-sm font-semibold transition',
                active === n.id ? 'bg-lime-400 text-leaf-950 shadow-3d' : 'text-ink-300 hover:bg-white/5 hover:text-white',
              )}
            >
              {n.icon}
              <span className="flex-1">{n.label}</span>
              {dirtyIds.includes(n.id) && <span className={cx('h-2 w-2 rounded-full', active === n.id ? 'bg-leaf-950' : 'bg-amber-400')} title="שינויים שלא נשמרו" />}
            </button>
          ))}
        </nav>

        {section ? (
          <Panel
            title={
              <span className="flex items-center gap-2">
                <span className="text-lime-400">{section.icon}</span>
                {section.label}
              </span>
            }
            subtitle={section.description}
            actions={
              <>
                {dirty && (
                  <Button size="sm" variant="a-ghost" className="a-btn-ghost" icon={<RotateCcw size={14} />} onClick={discard}>
                    ביטול
                  </Button>
                )}
                <Button size="sm" icon={<Save size={15} />} onClick={save} loading={saving} disabled={!dirty}>
                  שמירה
                </Button>
              </>
            }
          >
            {section.note && (
              <div className="mb-5 flex items-start gap-2 rounded-2xl bg-sky-400/[0.08] px-4 py-3 text-sm leading-relaxed text-sky-100 ring-1 ring-sky-400/15">
                <Info size={16} className="mt-0.5 shrink-0 text-sky-300" />
                <div>{section.note}</div>
              </div>
            )}
            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
              {section.fields.map((f) => (
                <SettingField key={f.key} f={f} value={values[f.key]} onChange={(v) => setVal(f.key, v)} />
              ))}
            </div>
            {active === 'deals' && Number(values.minHours) > Number(values.maxHours) && (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-amber-300">
                <AlertTriangle size={15} /> המשך המינימלי גדול מהמקסימלי
              </p>
            )}
            {active === 'email' && <EmailTest disabled={dirty} />}
          </Panel>
        ) : (
          <SystemPanel />
        )}
      </div>
    </div>
  );
}

function SettingField({ f, value, onChange }: { f: FieldDef; value: string | number | boolean | undefined; onChange: (v: string | number | boolean) => void }) {
  if (f.type === 'bool') {
    return (
      <div className={cx('rounded-2xl bg-black/20 px-4 py-3 ring-1 ring-white/5', f.full && 'md:col-span-2')}>
        <Switch dark checked={!!value} onChange={onChange} label={f.label} description={f.hint} />
      </div>
    );
  }
  const common = { dark: true, dir: f.ltr ? 'ltr' : undefined, className: f.ltr ? 'text-left' : undefined } as const;
  let input: ReactNode;
  if (f.type === 'textarea') input = <Textarea dark rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === 'select')
    input = (
      <DarkSelect value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </DarkSelect>
    );
  else if (f.type === 'number')
    input = (
      <div className="relative">
        <Input {...common} type="number" min={f.min} max={f.max} step={f.step ?? 1} value={value === undefined ? '' : Number(value)} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={cx(f.suffix && 'pl-16')} />
        {f.suffix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">{f.suffix}</span>}
      </div>
    );
  else input = <Input {...common} type={f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text'} autoComplete={f.type === 'password' ? 'new-password' : undefined} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  return (
    <Field dark label={f.label} hint={f.hint} className={cx(f.full && 'md:col-span-2')}>
      {input}
    </Field>
  );
}

function EmailTest({ disabled }: { disabled: boolean }) {
  const toast = useToast();
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.post('/admin/settings/email/test', { to: to || undefined });
      toast('מייל הבדיקה נשלח בהצלחה');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-4">
      <h3 className="mb-1 text-sm font-bold text-white">בדיקת שליחה</h3>
      <p className="mb-3 text-xs text-ink-400">{disabled ? 'שמרו את ההגדרות לפני הבדיקה.' : 'שולח מייל בדיקה עם ההגדרות השמורות (ריק = לאימייל שלכם).'}</p>
      <div className="flex flex-wrap gap-2">
        <Input dark type="email" dir="ltr" className="!w-72 max-w-full text-left" placeholder="test@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button size="sm" variant="a-outline" className="a-btn-outline" icon={<Send size={14} />} loading={busy} disabled={disabled} onClick={send}>
          שליחת מייל בדיקה
        </Button>
      </div>
    </div>
  );
}

function SystemPanel() {
  const toast = useToast();
  const info = useApi<{ node: string; uptime: number; memory: number; counts: Record<string, number> }>('/admin/system/info');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const res = await api.post<Record<string, unknown>>('/admin/system/run-jobs');
      setResult(res);
      toast('המשימות המתוזמנות הורצו');
      info.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const d = info.data;
  const up = d ? `${Math.floor(d.uptime / 3600)} ש׳ ${Math.floor((d.uptime % 3600) / 60)} ד׳` : '—';
  const COUNT_LABEL: Record<string, string> = { users: 'משתמשים', businesses: 'עסקים', deals: 'דילים פעילים', history: 'דילים בהיסטוריה', events: 'אירועי אנליטיקס', payments: 'תשלומים' };
  const RES_LABEL: Record<string, string> = { activated: 'דילים מתוזמנים שעלו', expired: 'דילים שפגו ונמחקו', trialWarnings: 'התראות סיום ניסיון', trialBlocked: 'חשבונות שנחסמו בסיום ניסיון' };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="גרסת Node" value={<span className="font-mono text-xl" dir="ltr">{d?.node ?? '—'}</span>} icon={<Server size={20} />} tone="sky" />
        <StatTile label="זמן פעילות" value={<span className="text-xl">{up}</span>} icon={<Timer size={20} />} tone="lime" />
        <StatTile label="זיכרון" value={d ? `${d.memory}MB` : '—'} icon={<Database size={20} />} tone="violet" />
      </div>
      <Panel title="נתוני מערכת">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(d?.counts ?? {}).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/5">
              <div className="text-xs text-ink-400">{COUNT_LABEL[k] || k}</div>
              <div className="mt-1 text-xl font-black tabular-nums text-white">{Number(v).toLocaleString('he-IL')}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="משימות מתוזמנות" subtitle="רצות אוטומטית כל 30 שניות: העלאת דילים מתוזמנים, מחיקת דילים שפגו (עד 48 שעות), התראות וחסימות סיום ניסיון, חידושי מנוי, טוקן יומי וניקוי נתונים.">
        <Button icon={<PlayCircle size={16} />} loading={busy} onClick={run}>
          הרצה עכשיו
        </Button>
        {result && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(RES_LABEL).map(([k, label]) => (
              <div key={k} className="rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/5">
                <div className="text-xs text-ink-400">{label}</div>
                <div className="mt-1 text-xl font-black tabular-nums text-white">{String(result[k] ?? 0)}</div>
              </div>
            ))}
            {'error' in result && <p className="col-span-full text-sm text-red-300">{String(result.error)}</p>}
          </div>
        )}
      </Panel>
    </div>
  );
}
