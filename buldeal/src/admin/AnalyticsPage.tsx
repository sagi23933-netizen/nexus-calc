import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity, BarChart3, Download, Eye, FileSpreadsheet, FileText, MousePointerClick, Navigation, Phone, RefreshCw, Share2, UserPlus, Users, Layers,
} from 'lucide-react';
import { api, errMsg, qs } from '../lib/api';
import { compact, shortDay } from '../lib/format';
import { CHART_DARK, SERIES_DARK } from '../shared/charts';
import { Button, Empty, Input, Skeleton, StatusDot, Tabs, cx } from '../shared/ui';
import { ChartTooltip, Legend, PageHeader, Panel, StatTile } from './kit';
import { BarList, DarkSelect, dayIL, dayRange, daysAgoIL } from './parts';

interface Pair {
  label: string;
  value: number;
  color?: string;
}
interface Report {
  from: string;
  to: string;
  daily: { day: string; views: number; visitors: number; sessions: number; deal_views: number; deal_clicks: number; signups: number }[];
  totals: { views: number | null; visitors: number | null; sessions: number | null; deal_views: number | null; phone_clicks: number | null; waze_clicks: number | null; shares: number | null; signups: number | null };
  devices: Pair[];
  browsers: Pair[];
  os: Pair[];
  referrers: Pair[];
  pages: Pair[];
  hours: { hour: number; value: number }[];
  cities: Pair[];
  categories: Pair[];
  live: number;
  topDeals: { title: string; business: string; views: number; clicks_phone: number; clicks_waze: number; feedback: 'yes' | 'no' | null }[];
}

type Preset = 'today' | '7' | '30' | '90' | 'custom';
const DEVICE: Record<string, string> = { mobile: 'נייד', desktop: 'מחשב', tablet: 'טאבלט' };
const DATASETS = [
  { value: 'events', label: 'כל הכניסות והאירועים (גולמי)' },
  { value: 'daily', label: 'סיכום יומי' },
  { value: 'deals', label: 'דילים שהסתיימו + משוב' },
  { value: 'businesses', label: 'רשימת עסקים' },
  { value: 'payments', label: 'תשלומים' },
];

const n0 = (v: number | null | undefined) => Number(v) || 0;

function presetRange(p: Preset): [string, string] {
  const today = dayIL();
  if (p === 'today') return [today, today];
  const days = Number(p);
  return [daysAgoIL(days - 1), today];
}

function prevRange(from: string, to: string): [string, string] {
  const span = dayRange(from, to).length;
  const end = new Date(`${from}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (span - 1));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<Preset>('30');
  const [range, setRange] = useState<[string, string]>(() => presetRange('30'));
  const [custom, setCustom] = useState<[string, string]>(() => presetRange('30'));
  const [data, setData] = useState<Report | null>(null);
  const [prev, setPrev] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [metric, setMetric] = useState<'traffic' | 'engagement'>('traffic');
  const [dataset, setDataset] = useState('events');

  useEffect(() => {
    const ctrl = new AbortController();
    const [from, to] = range;
    const [pf, pt] = prevRange(from, to);
    setLoading(true);
    Promise.all([api.get<Report>(`/admin/analytics${qs({ from, to })}`, ctrl.signal), api.get<Report>(`/admin/analytics${qs({ from: pf, to: pt })}`, ctrl.signal)])
      .then(([cur, before]) => {
        setData(cur);
        setPrev(before);
        setError(null);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(errMsg(e)))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [range, tick]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p));
  };

  const series = useMemo(() => {
    if (!data) return [];
    const byDay = new Map(data.daily.map((d) => [d.day, d]));
    return dayRange(range[0], range[1]).map((day) => {
      const d = byDay.get(day);
      return { day, views: n0(d?.views), visitors: n0(d?.visitors), sessions: n0(d?.sessions), deal_views: n0(d?.deal_views), deal_clicks: n0(d?.deal_clicks), signups: n0(d?.signups) };
    });
  }, [data, range]);

  const hours = useMemo(() => {
    const m = new Map((data?.hours ?? []).map((h) => [h.hour, h.value]));
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, value: m.get(h) ?? 0 }));
  }, [data]);

  const t = data?.totals;
  const p = prev?.totals;
  const clicks = n0(t?.phone_clicks) + n0(t?.waze_clicks);
  const funnel = [
    { label: 'צפיות בעמודים', value: n0(t?.views) },
    { label: 'צפיות בדילים', value: n0(t?.deal_views) },
    { label: 'לחיצות חיוג / Waze', value: clicks },
    { label: 'הרשמות עסקים', value: n0(t?.signups) },
  ];

  const lines =
    metric === 'traffic'
      ? [
          { key: 'views', name: 'צפיות', color: SERIES_DARK[0] },
          { key: 'visitors', name: 'מבקרים ייחודיים', color: SERIES_DARK[1] },
          { key: 'sessions', name: 'ביקורים', color: SERIES_DARK[2] },
        ]
      : [
          { key: 'deal_views', name: 'צפיות בדילים', color: SERIES_DARK[0] },
          { key: 'deal_clicks', name: 'לחיצות על דילים', color: SERIES_DARK[1] },
          { key: 'signups', name: 'הרשמות', color: SERIES_DARK[2] },
        ];

  const exportHref = (format: 'csv' | 'xlsx') => `/api/admin/export${qs({ dataset, format, from: range[0], to: range[1] })}`;
  const rangeLabel = range[0] === range[1] ? range[0].split('-').reverse().join('/') : `${range[0].split('-').reverse().join('/')} – ${range[1].split('-').reverse().join('/')}`;

  return (
    <div>
      <PageHeader
        title="אנליטיקס וכניסות"
        subtitle={`מעקב אחר הכניסות לאתר, צפיות ולחיצות על דילים · ${rangeLabel}`}
        icon={<BarChart3 size={22} />}
        actions={
          <>
            <span className="chip bg-lime-400/10 text-lime-300 ring-1 ring-lime-400/20">
              <StatusDot tone="green" />
              {data?.live ?? 0} מבקרים עכשיו
            </span>
            <Button size="sm" variant="a-outline" className="a-btn-outline" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />} onClick={() => setTick((x) => x + 1)}>
              רענון
            </Button>
          </>
        }
      />

      {/* range */}
      <div className="a-card mb-5 flex flex-wrap items-center gap-3 !rounded-2xl p-2">
        <Tabs
          dark
          value={preset}
          onChange={choosePreset}
          tabs={[
            { value: 'today', label: 'היום' },
            { value: '7', label: '7 ימים' },
            { value: '30', label: '30 ימים' },
            { value: '90', label: '90 ימים' },
            { value: 'custom', label: 'טווח מותאם' },
          ]}
        />
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Input dark type="date" className="!w-40 !py-1.5 text-sm" value={custom[0]} max={custom[1]} onChange={(e) => setCustom([e.target.value, custom[1]])} />
            <span className="text-ink-500">עד</span>
            <Input dark type="date" className="!w-40 !py-1.5 text-sm" value={custom[1]} min={custom[0]} max={dayIL()} onChange={(e) => setCustom([custom[0], e.target.value])} />
            <Button size="sm" onClick={() => custom[0] && custom[1] && custom[0] <= custom[1] && setRange([custom[0], custom[1]])}>
              החלה
            </Button>
          </div>
        )}
      </div>

      {error && <div className="mb-5 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">{error}</div>}

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!data
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[112px] !rounded-3xl" />)
          : [
              { label: 'צפיות בעמודים', value: n0(t?.views), prev: n0(p?.views), icon: <Eye size={20} />, tone: 'lime' as const },
              { label: 'מבקרים ייחודיים', value: n0(t?.visitors), prev: n0(p?.visitors), icon: <Users size={20} />, tone: 'sky' as const },
              { label: 'ביקורים (סשנים)', value: n0(t?.sessions), prev: n0(p?.sessions), icon: <Layers size={20} />, tone: 'violet' as const },
              { label: 'צפיות בדילים', value: n0(t?.deal_views), prev: n0(p?.deal_views), icon: <Activity size={20} />, tone: 'amber' as const },
              { label: 'לחיצות חיוג', value: n0(t?.phone_clicks), prev: n0(p?.phone_clicks), icon: <Phone size={20} />, tone: 'lime' as const },
              { label: 'ניווטים ב-Waze', value: n0(t?.waze_clicks), prev: n0(p?.waze_clicks), icon: <Navigation size={20} />, tone: 'sky' as const },
              { label: 'שיתופים', value: n0(t?.shares), prev: n0(p?.shares), icon: <Share2 size={20} />, tone: 'wood' as const },
              { label: 'הרשמות עסקים', value: n0(t?.signups), prev: n0(p?.signups), icon: <UserPlus size={20} />, tone: 'violet' as const },
            ].map((k) => <StatTile key={k.label} label={k.label} value={k.value.toLocaleString('he-IL')} icon={k.icon} tone={k.tone} delta={delta(k.value, k.prev)} hint="מול התקופה הקודמת" />)}
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="מגמה יומית"
          subtitle="לפי שעון ישראל"
          actions={
            <Tabs
              dark
              value={metric}
              onChange={setMetric}
              tabs={[
                { value: 'traffic', label: 'תנועה' },
                { value: 'engagement', label: 'מעורבות' },
              ]}
            />
          }
        >
          <div className="mb-3">
            <Legend items={lines.map((l) => ({ label: l.name, color: l.color, value: compact(series.reduce((a, d) => a + (d[l.key as keyof typeof d] as number), 0)) }))} />
          </div>
          <div className="h-[300px]" dir="ltr">
            {loading && !data ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="an-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lines[0].color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={lines[0].color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_DARK.grid} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: CHART_DARK.axis, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: CHART_DARK.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} />
                  <Tooltip content={<ChartTooltip labelFormatter={shortDay} />} cursor={{ stroke: CHART_DARK.axis, strokeDasharray: '3 3' }} />
                  <Area type="monotone" dataKey={lines[0].key} name={lines[0].name} stroke={lines[0].color} strokeWidth={2} fill="url(#an-fill)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_DARK.surface }} />
                  {lines.slice(1).map((l) => (
                    <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_DARK.surface }} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="משפך המרה" subtitle="מכניסה לאתר ועד פנייה לעסק">
          <div className="space-y-4">
            {funnel.map((f, i) => {
              const base = funnel[0].value || 1;
              const prevStep = i > 0 ? funnel[i - 1].value : 0;
              return (
                <div key={f.label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="text-ink-200">{f.label}</span>
                    <span className="flex items-baseline gap-2 tabular-nums">
                      <b className="text-white">{f.value.toLocaleString('he-IL')}</b>
                      {i > 0 && <span className="text-xs text-ink-400">{prevStep ? `(${((f.value / prevStep) * 100).toFixed(1)}% מהשלב הקודם)` : '—'}</span>}
                    </span>
                  </div>
                  <div className="h-7 overflow-hidden rounded-lg bg-white/[0.05]">
                    <div
                      className="flex h-full items-center rounded-lg px-2 text-[11px] font-bold text-leaf-950 transition-[width] duration-700"
                      style={{ width: `${Math.max(3, (f.value / base) * 100)}%`, background: `linear-gradient(90deg, ${SERIES_DARK[0]}, #a3d520)` }}
                    >
                      {f.value / base >= 0.12 && `${((f.value / base) * 100).toFixed(f.value / base < 0.1 ? 1 : 0)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-xs leading-relaxed text-ink-400">
              יחס לחיצה כללי: <b className="text-white">{n0(t?.deal_views) ? ((clicks / n0(t?.deal_views)) * 100).toFixed(1) : '0'}%</b> מהצפיות בדילים הסתיימו בחיוג או בניווט לעסק.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <Panel title="שעות שיא" subtitle="צפיות לפי שעה ביום" className="lg:col-span-2">
          <div className="h-[220px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={CHART_DARK.grid} vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: CHART_DARK.axis, fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: CHART_DARK.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={compact} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="value" name="צפיות" fill={SERIES_DARK[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="מכשירים">
          <BarList items={(data?.devices ?? []).map((d) => ({ label: DEVICE[d.label] || d.label || 'לא ידוע', value: d.value }))} />
        </Panel>
        <Panel title="מערכות הפעלה">
          <BarList items={(data?.os ?? []).map((d) => ({ label: d.label || 'לא ידוע', value: d.value }))} />
        </Panel>
        <Panel title="דפדפנים">
          <BarList items={(data?.browsers ?? []).map((d) => ({ label: d.label || 'לא ידוע', value: d.value }))} />
        </Panel>
        <Panel title="מקורות תנועה">
          <BarList items={(data?.referrers ?? []).map((d) => ({ label: d.label, value: d.value }))} />
        </Panel>
        <Panel title="ערים מבוקשות" subtitle="סינון וצפייה לפי עיר">
          <BarList items={(data?.cities ?? []).map((d) => ({ label: d.label, value: d.value }))} />
        </Panel>
        <Panel title="קטגוריות מבוקשות">
          <BarList items={(data?.categories ?? []).map((d) => ({ label: d.label, value: d.value }))} />
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <Panel title="עמודים נצפים" className="xl:col-span-1">
          <BarList items={(data?.pages ?? []).map((d) => ({ label: <span dir="ltr" className="font-mono text-xs">{d.label || '/'}</span>, value: d.value, key: d.label }))} />
        </Panel>
        <Panel title="דילים מובילים בתקופה" subtitle="דילים שהסתיימו, לפי צפיות" padded={false} className="xl:col-span-2">
          {data && data.topDeals.length === 0 ? (
            <Empty dark title="אין דילים שהסתיימו בטווח" />
          ) : (
            <div className="overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>דיל</th>
                    <th>עסק</th>
                    <th className="text-center">צפיות</th>
                    <th className="text-center">חיוג</th>
                    <th className="text-center">Waze</th>
                    <th className="text-center">עזר?</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topDeals ?? []).map((d, i) => (
                    <tr key={i}>
                      <td className="max-w-[220px] truncate font-semibold text-white">{d.title}</td>
                      <td className="text-ink-300">{d.business}</td>
                      <td className="text-center tabular-nums">{d.views.toLocaleString('he-IL')}</td>
                      <td className="text-center tabular-nums">{d.clicks_phone}</td>
                      <td className="text-center tabular-nums">{d.clicks_waze}</td>
                      <td className="text-center">
                        {d.feedback === 'yes' ? <span className="chip bg-lime-400/10 text-lime-300">כן</span> : d.feedback === 'no' ? <span className="chip bg-red-400/10 text-red-300">לא</span> : <span className="text-ink-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="ייצוא נתונים" subtitle={`הקובץ יכלול את הטווח הנבחר (${rangeLabel})`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[260px] flex-1">
            <span className="a-label">מה לייצא?</span>
            <DarkSelect value={dataset} onChange={(e) => setDataset(e.target.value)}>
              {DATASETS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </DarkSelect>
          </label>
          <a href={exportHref('xlsx')} download className={cx('btn btn-lime')}>
            <FileSpreadsheet size={17} /> Excel
          </a>
          <a href={exportHref('csv')} download className="btn a-btn-outline a-outline">
            <FileText size={17} /> CSV
          </a>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
          <Download size={13} /> הנתונים אנונימיים — נשמרים מזהי מבקר אקראיים בלבד, ללא כתובות IP. <MousePointerClick size={13} className="mr-2" /> ייצוא ״רשימת עסקים״ אינו תלוי בטווח.
        </p>
      </Panel>
    </div>
  );
}
