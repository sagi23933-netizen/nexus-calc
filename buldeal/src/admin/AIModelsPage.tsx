import { useState } from 'react';
import {
  Bot, CheckCircle2, CircleX, Cpu, FlaskConical, KeyRound, Pencil, Plus, Power, RotateCcw, Save, Sparkles, Trash2, Wand2, Zap, Clock, AlertTriangle,
} from 'lucide-react';
import { api, errMsg, qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import { dateTime, relative } from '../lib/format';
import type { Category, City, Deal, DealDesign } from '../lib/types';
import { DealCard } from '../shared/DealCard';
import { Button, Confirm, Empty, Field, Input, Modal, Pagination, Skeleton, StatusBadge, Switch, Textarea, Tilt, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { PageHeader, Panel, StatTile } from './kit';
import { DarkSelect } from './parts';
import { Segmented } from './studio/controls';

interface AIModel {
  id: number;
  name: string;
  provider: 'anthropic' | 'builtin';
  model_id: string;
  effort: string;
  max_tokens: number;
  system_prompt: string;
  creativity: 'calm' | 'balanced' | 'bold';
  is_active: boolean;
  has_key: boolean;
  key_source: 'db' | 'env' | 'none';
  api_key_masked: string;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string;
}
interface ModelsRes {
  models: AIModel[];
  catalog: { id: string; label: string }[];
  efforts: string[];
  defaultPrompt: string;
  settings: { enabled: boolean; fallbackToBuiltin: boolean; timeoutMs: number };
  usage: { calls: number; ok: number | null; avg_latency: number | null; input_tokens: number; output_tokens: number };
}
interface LogRow {
  id: number;
  provider: string;
  model_id: string;
  purpose: string;
  business: string | null;
  success: number;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  error: string;
  created_at: string;
}
interface SampleDeal {
  title: string;
  description?: string;
  original_price: number;
  discount_percent: number;
  final_price: number;
  duration_hours: number;
}

const EFFORT_LABEL: Record<string, string> = {
  low: 'נמוך — מהיר וחסכוני (מומלץ לכרטיסים)',
  medium: 'בינוני',
  high: 'גבוה',
  xhigh: 'גבוה מאוד',
  max: 'מקסימלי — האיטי והיקר ביותר',
};
const CREATIVITY = [
  { value: 'calm' as const, label: 'נקי ומאופק' },
  { value: 'balanced' as const, label: 'מאוזן' },
  { value: 'bold' as const, label: 'נועז' },
];
const PURPOSE: Record<string, string> = { deal_design: 'עיצוב דיל', redesign: 'עיצוב מחדש', test: 'בדיקת חיבור', preview: 'סביבת ניסוי' };

/** Wrap an AI design + sample deal data as a Deal so the real DealCard can render it. */
function sampleToDeal(d: SampleDeal, design: DealDesign, meta: { business: string; category?: { name: string; slug: string } | null; city?: string; source: 'ai' | 'builtin' }): Deal {
  const now = Date.now();
  return {
    id: 0,
    title: d.title,
    description: d.description || '',
    original_price: d.original_price,
    discount_percent: d.discount_percent,
    final_price: d.final_price,
    image_url: '',
    duration_hours: d.duration_hours,
    starts_at: new Date(now).toISOString(),
    expires_at: new Date(now + d.duration_hours * 3600_000).toISOString(),
    status: 'active',
    featured: false,
    design,
    design_source: meta.source,
    business: { id: 0, name: meta.business, slug: '', logo_url: '', phone: '03-5551234', whatsapp: '', address: `רחוב הדוגמה 12${meta.city ? `, ${meta.city}` : ''}`, waze_url: 'https://waze.com/ul' },
    category: meta.category ? { id: 0, name: meta.category.name, slug: meta.category.slug, icon: 'Tag', color: '#7cc22a' } : null,
    city: meta.city ? { id: 0, name: meta.city, slug: '' } : null,
  };
}

interface Draft {
  id?: number;
  name: string;
  provider: 'anthropic' | 'builtin';
  model_id: string;
  customModel: boolean;
  api_key: string;
  clear_key: boolean;
  effort: string;
  max_tokens: number;
  creativity: 'calm' | 'balanced' | 'bold';
  system_prompt: string;
  masked: string;
  key_source: AIModel['key_source'];
}

export default function AIModelsPage() {
  const toast = useToast();
  const { data, loading, reload, setData } = useApi<ModelsRes>('/admin/ai/models');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AIModel | null>(null);
  const [test, setTest] = useState<{ model: AIModel; ok: boolean; message: string; deal?: Deal } | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<ModelsRes['settings'] | null>(null);
  const [logPage, setLogPage] = useState(1);
  const logs = useApi<{ items: LogRow[]; total: number; page: number; size: number }>(`/admin/ai/logs${qs({ page: logPage, size: 12 })}`);

  const settings = settingsDraft ?? data?.settings ?? null;

  const openNew = () =>
    setDraft({ name: 'מודל חדש', provider: 'anthropic', model_id: data?.catalog[0]?.id || 'claude-opus-5-5', customModel: false, api_key: '', clear_key: false, effort: 'low', max_tokens: 16000, creativity: 'balanced', system_prompt: data?.defaultPrompt || '', masked: '', key_source: 'none' });

  const openEdit = (m: AIModel) =>
    setDraft({
      id: m.id,
      name: m.name,
      provider: m.provider,
      model_id: m.provider === 'builtin' ? data?.catalog[0]?.id || 'claude-opus-5-5' : m.model_id,
      customModel: m.provider === 'anthropic' && !data?.catalog.some((c) => c.id === m.model_id),
      api_key: '',
      clear_key: false,
      effort: m.effort,
      max_tokens: m.max_tokens || 16000,
      creativity: m.creativity,
      system_prompt: m.system_prompt,
      masked: m.api_key_masked,
      key_source: m.key_source,
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast('יש להזין שם', 'error');
    setSaving(true);
    const body = {
      name: draft.name,
      provider: draft.provider,
      model_id: draft.provider === 'builtin' ? 'builtin' : draft.model_id.trim(),
      effort: draft.effort,
      max_tokens: draft.max_tokens,
      creativity: draft.creativity,
      system_prompt: draft.system_prompt,
      api_key: draft.api_key.trim() || undefined,
      clear_key: draft.clear_key || undefined,
    };
    try {
      if (draft.id) await api.put(`/admin/ai/models/${draft.id}`, body);
      else await api.post('/admin/ai/models', body);
      toast('המודל נשמר');
      setDraft(null);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (m: AIModel) => {
    setBusy(`act-${m.id}`);
    try {
      await api.post(`/admin/ai/models/${m.id}/activate`);
      toast(`"${m.name}" הוא עכשיו המודל הפעיל לעיצוב דילים`);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const runTest = async (m: AIModel) => {
    setBusy(`test-${m.id}`);
    try {
      const res = await api.post<{ ok: boolean; message: string; latencyMs: number; design?: DealDesign; sample?: SampleDeal }>(`/admin/ai/models/${m.id}/test`);
      setTest({
        model: m,
        ok: res.ok,
        message: res.message,
        deal: res.ok && res.design && res.sample ? sampleToDeal(res.sample, res.design, { business: 'פיצה בזק', category: { name: 'מסעדות ואוכל', slug: 'food' }, city: 'תל אביב-יפו', source: 'ai' }) : undefined,
      });
      reload();
      logs.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setBusy('delete');
    try {
      await api.del(`/admin/ai/models/${toDelete.id}`);
      toast('המודל נמחק');
      setToDelete(null);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setBusy('settings');
    try {
      await api.put('/admin/settings/ai', settings);
      setData((d) => (d ? { ...d, settings } : d));
      setSettingsDraft(null);
      toast('הגדרות ה-AI נשמרו');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const usage = data?.usage;
  const successRate = usage && usage.calls ? Math.round(((usage.ok ?? 0) / usage.calls) * 100) : null;
  const active = data?.models.find((m) => m.is_active);

  return (
    <div>
      <PageHeader
        title="מודלי AI"
        subtitle="ה-AI מעצב כל כרטיס דיל לפי הנתונים והקטגוריה של העסק. כאן בוחרים מודל, מפתח, רמת מאמץ והנחיות עיצוב."
        icon={<Bot size={22} />}
        actions={
          <Button icon={<Plus size={16} />} onClick={openNew} disabled={!data}>
            מודל חדש
          </Button>
        }
      />

      {/* status + usage */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!data ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[112px] !rounded-3xl" />)
        ) : (
          <>
            <StatTile label="מודל פעיל" value={<span className="text-xl">{active ? (active.provider === 'anthropic' ? 'Claude' : 'מעצב מובנה') : '—'}</span>} icon={<Cpu size={20} />} tone="lime" hint={active?.provider === 'anthropic' ? <span dir="ltr">{active.model_id}</span> : 'ללא קריאה חיצונית'} />
            <StatTile label="קריאות AI (30 יום)" value={(usage?.calls ?? 0).toLocaleString('he-IL')} icon={<Zap size={20} />} tone="sky" hint={successRate != null ? `${successRate}% הצלחה` : 'אין קריאות עדיין'} />
            <StatTile label="זמן תגובה ממוצע" value={usage?.avg_latency ? `${(usage.avg_latency / 1000).toFixed(1)}s` : '—'} icon={<Clock size={20} />} tone="amber" hint="בקריאות מוצלחות" />
            <StatTile label="טוקנים (קלט / פלט)" value={<span className="text-xl" dir="ltr">{`${(usage?.input_tokens ?? 0).toLocaleString('he-IL')} / ${(usage?.output_tokens ?? 0).toLocaleString('he-IL')}`}</span>} icon={<Sparkles size={20} />} tone="violet" hint="30 יום אחרונים" />
          </>
        )}
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        {/* models */}
        <div className="xl:col-span-2">
          {loading && !data ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-60 !rounded-3xl" />
              <Skeleton className="h-60 !rounded-3xl" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data?.models.map((m) => (
                <Tilt key={m.id} max={5} scale={1.01} style={{ borderRadius: 24 }}>
                  <div className={cx('a-card relative flex h-full flex-col overflow-hidden p-5', m.is_active && 'ring-2 ring-lime-400/70')} style={m.is_active ? { boxShadow: '0 0 0 1px rgba(163,213,32,.3), 0 20px 60px -20px rgba(140,193,10,.45)' } : undefined}>
                    {m.is_active && <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-lime-400/20 blur-3xl" />}
                    <div className="relative flex items-start gap-3">
                      <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-3d', m.provider === 'anthropic' ? 'bg-gradient-to-br from-wood-300 to-wood-600 text-white' : 'bg-gradient-to-br from-ink-300 to-ink-600 text-white')}>
                        {m.provider === 'anthropic' ? <Sparkles size={22} /> : <Wand2 size={22} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-bold text-white">{m.name}</h3>
                          {m.is_active && <span className="chip bg-lime-400 text-leaf-950">פעיל</span>}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-ink-400" dir="ltr">
                          {m.provider === 'anthropic' ? m.model_id : 'built-in designer'}
                        </div>
                      </div>
                    </div>
                    <dl className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <dt className="text-ink-500">ספק</dt>
                        <dd className="font-semibold text-ink-100">{m.provider === 'anthropic' ? 'Anthropic Claude' : 'מעצב מובנה'}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-500">יצירתיות</dt>
                        <dd className="font-semibold text-ink-100">{CREATIVITY.find((c) => c.value === m.creativity)?.label}</dd>
                      </div>
                      {m.provider === 'anthropic' && (
                        <>
                          <div>
                            <dt className="text-ink-500">רמת מאמץ</dt>
                            <dd className="font-semibold text-ink-100">{m.effort}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-500">מפתח API</dt>
                            <dd className={cx('flex items-center gap-1 font-semibold', m.key_source === 'none' ? 'text-amber-300' : 'text-ink-100')}>
                              <KeyRound size={12} />
                              {m.key_source === 'db' ? <span dir="ltr">{m.api_key_masked}</span> : m.key_source === 'env' ? 'ממשתנה סביבה' : 'לא הוגדר'}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>
                    <div className="relative mt-4 rounded-xl bg-black/25 px-3 py-2 text-xs">
                      {m.last_test_at ? (
                        <div className={cx('flex items-start gap-1.5', m.last_test_ok ? 'text-lime-300' : 'text-red-300')}>
                          {m.last_test_ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <CircleX size={14} className="mt-0.5 shrink-0" />}
                          <span className="min-w-0">
                            {m.last_test_message}
                            <span className="mr-1 text-ink-500">· {relative(m.last_test_at)}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-500">טרם נבדק החיבור</span>
                      )}
                    </div>
                    <div className="relative mt-4 flex flex-wrap gap-2 pt-1">
                      {!m.is_active && (
                        <Button size="sm" icon={<Power size={14} />} loading={busy === `act-${m.id}`} onClick={() => activate(m)}>
                          הפעלה
                        </Button>
                      )}
                      <Button size="sm" variant="a-outline" className="a-btn-outline" icon={<FlaskConical size={14} />} loading={busy === `test-${m.id}`} onClick={() => runTest(m)}>
                        בדיקת חיבור
                      </Button>
                      <Button size="sm" variant="a-ghost" className="a-btn-ghost" icon={<Pencil size={14} />} onClick={() => openEdit(m)}>
                        עריכה
                      </Button>
                      {!m.is_active && (
                        <button type="button" className="btn-icon mr-auto h-8 w-8 text-red-300 hover:bg-red-500/10" onClick={() => setToDelete(m)} aria-label="מחיקה">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </Tilt>
              ))}
            </div>
          )}
        </div>

        {/* AI settings that apply to every publish */}
        <Panel title="הגדרות עיצוב AI" subtitle="חלות על כל פרסום דיל">
          {settings ? (
            <div className="space-y-4">
              <Switch dark checked={settings.enabled} onChange={(v) => setSettingsDraft({ ...settings, enabled: v })} label="עיצוב AI פעיל" description="כבוי = כל הכרטיסים יעוצבו במעצב המובנה" />
              <Switch dark checked={settings.fallbackToBuiltin} onChange={(v) => setSettingsDraft({ ...settings, fallbackToBuiltin: v })} label="גיבוי למעצב המובנה" description="אם ה-AI נכשל או איטי — הדיל יתפרסם בכל זאת עם עיצוב מובנה" />
              <Field dark label="זמן המתנה מקסימלי לתשובה (שניות)">
                <Input dark type="number" min={5} max={120} value={Math.round(settings.timeoutMs / 1000)} onChange={(e) => setSettingsDraft({ ...settings, timeoutMs: Math.max(5, Number(e.target.value)) * 1000 })} />
              </Field>
              {!settings.fallbackToBuiltin && (
                <p className="flex items-start gap-1.5 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> ללא גיבוי, תקלה במודל תמנע מעסקים לפרסם דילים.
                </p>
              )}
              <Button className="w-full" icon={<Save size={15} />} disabled={!settingsDraft} loading={busy === 'settings'} onClick={saveSettings}>
                שמירת הגדרות
              </Button>
            </div>
          ) : (
            <Skeleton className="h-48" />
          )}
        </Panel>
      </div>

      <Playground categoriesReady={!!data} onDone={() => logs.reload()} />

      <Panel title="יומן קריאות AI" subtitle="כל עיצוב, עיצוב מחדש ובדיקה" padded={false} className="mt-5">
        {logs.data && logs.data.items.length === 0 ? (
          <Empty dark title="אין קריאות עדיין" text="היומן יתמלא כשעסקים יפרסמו דילים" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>זמן</th>
                    <th>מטרה</th>
                    <th>מודל</th>
                    <th>עסק</th>
                    <th>סטטוס</th>
                    <th className="text-center">זמן תגובה</th>
                    <th className="text-center">טוקנים</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs.data?.items ?? []).map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap text-ink-300">{dateTime(l.created_at)}</td>
                      <td>{PURPOSE[l.purpose] || l.purpose}</td>
                      <td className="font-mono text-xs text-ink-300" dir="ltr">
                        {l.model_id}
                      </td>
                      <td className="text-ink-300">{l.business || '—'}</td>
                      <td>
                        {l.success ? (
                          <StatusBadge dark status="paid" label="הצליח" />
                        ) : (
                          <span title={l.error}>
                            <StatusBadge dark status="failed" label="נכשל" />
                            <div className="mt-1 max-w-[260px] truncate text-[11px] text-red-300">{l.error}</div>
                          </span>
                        )}
                      </td>
                      <td className="text-center tabular-nums text-ink-300">{l.latency_ms ? `${(l.latency_ms / 1000).toFixed(1)}s` : '—'}</td>
                      <td className="text-center tabular-nums text-ink-300" dir="ltr">
                        {l.input_tokens || l.output_tokens ? `${l.input_tokens} / ${l.output_tokens}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.data && <Pagination dark page={logs.data.page} size={logs.data.size} total={logs.data.total} onPage={setLogPage} />}
          </>
        )}
      </Panel>

      {/* edit modal */}
      <Modal
        dark
        size="lg"
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'עריכת מודל' : 'מודל AI חדש'}
        footer={
          <>
            <Button variant="a-ghost" className="a-btn-ghost" onClick={() => setDraft(null)}>
              ביטול
            </Button>
            <Button onClick={save} loading={saving} icon={<Save size={15} />}>
              שמירה
            </Button>
          </>
        }
      >
        {draft && data && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field dark label="שם לתצוגה" required>
                <Input dark value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field dark label="ספק">
                <Segmented
                  value={draft.provider}
                  onChange={(v) => setDraft({ ...draft, provider: v })}
                  options={[
                    { value: 'anthropic', label: 'Anthropic Claude' },
                    { value: 'builtin', label: 'מעצב מובנה' },
                  ]}
                />
              </Field>
            </div>
            {draft.provider === 'builtin' ? (
              <p className="rounded-2xl bg-black/25 px-4 py-3 text-sm leading-relaxed text-ink-300">
                המעצב המובנה בוחר פלטה, תבנית, גופן וכותרת לפי הקטגוריה ואחוז ההנחה — מיידי, ללא עלות וללא חיבור חיצוני. מתאים כגיבוי או כשאין מפתח API.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field dark label="מודל">
                    <DarkSelect
                      value={draft.customModel ? '__custom' : draft.model_id}
                      onChange={(e) => (e.target.value === '__custom' ? setDraft({ ...draft, customModel: true }) : setDraft({ ...draft, customModel: false, model_id: e.target.value }))}
                    >
                      {data.catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                      <option value="__custom">מזהה מודל אחר…</option>
                    </DarkSelect>
                  </Field>
                  {draft.customModel ? (
                    <Field dark label="מזהה מודל" hint="למשל claude-sonnet-5-5">
                      <Input dark dir="ltr" className="text-left font-mono" value={draft.model_id} onChange={(e) => setDraft({ ...draft, model_id: e.target.value })} />
                    </Field>
                  ) : (
                    <Field dark label="רמת מאמץ (effort)" hint="כמה ״לחשוב״ לפני העיצוב — משפיע על מהירות ועלות">
                      <DarkSelect value={draft.effort} onChange={(e) => setDraft({ ...draft, effort: e.target.value })}>
                        {data.efforts.map((e) => (
                          <option key={e} value={e}>
                            {EFFORT_LABEL[e] || e}
                          </option>
                        ))}
                      </DarkSelect>
                    </Field>
                  )}
                </div>
                {draft.customModel && (
                  <Field dark label="רמת מאמץ (effort)">
                    <DarkSelect value={draft.effort} onChange={(e) => setDraft({ ...draft, effort: e.target.value })}>
                      {data.efforts.map((e) => (
                        <option key={e} value={e}>
                          {EFFORT_LABEL[e] || e}
                        </option>
                      ))}
                    </DarkSelect>
                  </Field>
                )}
                <Field
                  dark
                  label="מפתח API של Anthropic"
                  hint={
                    draft.masked
                      ? `מפתח שמור: ${draft.masked} — השאירו ריק כדי לא לשנות`
                      : draft.key_source === 'env'
                        ? 'כרגע נעשה שימוש במפתח מהמשתנה ANTHROPIC_API_KEY בשרת'
                        : 'המפתח נשמר בשרת ומוצג מוסתר בלבד'
                  }
                >
                  <Input dark type="password" autoComplete="off" dir="ltr" className="text-left font-mono" placeholder="sk-ant-…" value={draft.api_key} onChange={(e) => setDraft({ ...draft, api_key: e.target.value, clear_key: false })} />
                </Field>
                {draft.masked && <Switch dark checked={draft.clear_key} onChange={(v) => setDraft({ ...draft, clear_key: v, api_key: v ? '' : draft.api_key })} label="הסרת המפתח השמור" description="המודל ישתמש במפתח מהשרת (אם הוגדר)" />}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field dark label="רמת יצירתיות">
                    <Segmented value={draft.creativity} onChange={(v) => setDraft({ ...draft, creativity: v })} options={CREATIVITY} />
                  </Field>
                  <Field dark label="max_tokens" hint="תקרת אורך התשובה (2,000–64,000)">
                    <Input dark type="number" min={2000} max={64000} step={1000} value={draft.max_tokens} onChange={(e) => setDraft({ ...draft, max_tokens: Number(e.target.value) })} />
                  </Field>
                </div>
                <Field
                  dark
                  label={
                    <span className="flex items-center justify-between">
                      הנחיית מערכת (System prompt)
                      <button type="button" className="flex items-center gap-1 text-xs font-medium text-lime-400 hover:text-lime-300" onClick={() => setDraft({ ...draft, system_prompt: data.defaultPrompt })}>
                        <RotateCcw size={12} /> שחזור ברירת מחדל
                      </button>
                    </span>
                  }
                  hint="ההנחיות שה-AI מקבל לפני כל עיצוב. נתוני הדיל, הקטגוריה והעיר מצורפים אוטומטית."
                >
                  <Textarea dark rows={11} className="text-[13px] leading-relaxed" value={draft.system_prompt} onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })} />
                </Field>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* test result */}
      <Modal dark size={test?.deal ? 'lg' : 'sm'} open={!!test} onClose={() => setTest(null)} title={test ? `בדיקת חיבור — ${test.model.name}` : ''}>
        {test && (
          <div className="space-y-4">
            <div className={cx('flex items-start gap-2 rounded-2xl px-4 py-3 text-sm', test.ok ? 'bg-lime-400/10 text-lime-200' : 'bg-red-500/10 text-red-200')}>
              {test.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <CircleX size={18} className="mt-0.5 shrink-0" />}
              {test.message}
            </div>
            {test.deal && (
              <div className="grid items-start gap-5 sm:grid-cols-[320px_1fr]">
                <DealCard deal={test.deal} preview tilt />
                <div className="space-y-2 text-sm text-ink-300">
                  <p className="font-bold text-white">כך עיצב המודל דיל לדוגמה:</p>
                  <p>״{test.deal.title}״ · {test.deal.discount_percent}% הנחה</p>
                  <p>
                    אווירה: <b className="text-white">{test.deal.design.vibe}</b>
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-left text-[11px] text-ink-300" dir="ltr">
                    {JSON.stringify(test.deal.design, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Confirm dark danger open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={doDelete} loading={busy === 'delete'} title="מחיקת מודל" confirmText="מחיקה" body={toDelete && <>למחוק את המודל <b className="text-white">{toDelete.name}</b>?</>} />
    </div>
  );
}

/** Try the active model on any sample deal and see the real card. */
function Playground({ categoriesReady, onDone }: { categoriesReady: boolean; onDone: () => void }) {
  const toast = useToast();
  const cats = useApi<{ items: Category[] }>(categoriesReady ? '/admin/categories' : null);
  const cities = useApi<{ items: City[] }>(categoriesReady ? '/admin/cities' : null);
  const [form, setForm] = useState({ title: 'שני המבורגרים + צ׳יפס ושתייה', description: 'רק במסעדה, עד גמר המלאי', original_price: 120, discount_percent: 35, duration_hours: 6, categoryId: '', businessName: 'בורגר בזק', city: 'תל אביב-יפו' });
  const [result, setResult] = useState<{ deal: Deal; source: string; model: string; warning?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ design: DealDesign; source: 'ai' | 'builtin'; model: string; warning?: string; deal: SampleDeal }>('/admin/ai/preview', { ...form, categoryId: form.categoryId || undefined });
      const cat = cats.data?.items.find((c) => String(c.id) === form.categoryId);
      setResult({ deal: sampleToDeal(res.deal, res.design, { business: form.businessName || 'עסק לדוגמה', category: cat ? { name: cat.name, slug: cat.slug } : null, city: form.city, source: res.source }), source: res.source, model: res.model, warning: res.warning });
      onDone();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  const final = Math.round(form.original_price * (1 - form.discount_percent / 100) * 100) / 100;

  return (
    <Panel title="סביבת ניסוי" subtitle="נסו את המודל הפעיל על דיל לדוגמה — בלי לפרסם ובלי לחייב טוקן">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px_minmax(0,0.8fr)]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Field dark label="כותרת הדיל" className="sm:col-span-2">
            <Input dark value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field dark label="תיאור" className="sm:col-span-2">
            <Input dark value={form.description} maxLength={400} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field dark label="מחיר מקורי (₪)">
            <Input dark type="number" min={1} value={form.original_price} onChange={(e) => setForm({ ...form, original_price: Number(e.target.value) })} />
          </Field>
          <Field dark label={`הנחה (%) · מחיר סופי ₪${final}`}>
            <Input dark type="number" min={1} max={99} value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} />
          </Field>
          <Field dark label="קטגוריה">
            <DarkSelect value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">כללי</option>
              {cats.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </DarkSelect>
          </Field>
          <Field dark label="עיר">
            <DarkSelect value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
              {(cities.data?.items ?? [{ id: 0, name: form.city, slug: '' }]).map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </DarkSelect>
          </Field>
          <Field dark label="שם העסק">
            <Input dark value={form.businessName} maxLength={80} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          </Field>
          <Field dark label="משך (שעות)">
            <Input dark type="number" min={1} max={48} value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: Number(e.target.value) })} />
          </Field>
          <Button className="sm:col-span-2" icon={<Wand2 size={16} />} loading={loading} onClick={run}>
            עיצוב כרטיס עכשיו
          </Button>
        </div>
        <div>
          {result ? (
            <DealCard deal={result.deal} preview />
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-white/10 p-6 text-center text-sm text-ink-500">
              <Wand2 size={30} className="mb-3 text-lime-400/60" />
              הכרטיס המעוצב יופיע כאן
            </div>
          )}
        </div>
        {result && (
          <div className="space-y-3 text-sm lg:col-span-2 xl:col-span-1">
            <div className="flex flex-wrap gap-2">
              <span className={cx('chip', result.source === 'ai' ? 'bg-lime-400/15 text-lime-300' : 'bg-white/10 text-ink-200')}>{result.source === 'ai' ? '✨ עוצב ב-AI' : 'מעצב מובנה'}</span>
              <span className="chip bg-white/5 font-mono text-ink-300" dir="ltr">
                {result.model}
              </span>
            </div>
            {result.warning && (
              <p className="flex items-start gap-1.5 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                ה-AI נכשל ({result.warning}) — הוצג עיצוב גיבוי מובנה.
              </p>
            )}
            <pre className="max-h-[380px] overflow-auto rounded-xl bg-black/40 p-3 text-left text-[11px] leading-relaxed text-ink-300" dir="ltr">
              {JSON.stringify(result.deal.design, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Panel>
  );
}
