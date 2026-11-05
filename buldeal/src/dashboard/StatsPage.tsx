import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Eye, MousePointerClick, Navigation, Phone, Share2, ThumbsDown, ThumbsUp, Users, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { compact, date, num, shortDay } from '../lib/format';
import { Empty, Skeleton, Tabs } from '../shared/ui';
import { CHART_LIGHT, SERIES_LIGHT } from '../shared/charts';
import { ChartTooltip, Legend, NoDataOverlay, PageHeader, Panel, StatTile } from './kit';
import { fillDays } from './chartUtils';

interface Stats {
  series: { day: string; views: number; phone: number; waze: number; share: number }[];
  devices: { label: string; value: number }[];
  deals: { id: number; title: string; ended_at: string; views: number; clicks_phone: number; clicks_waze: number; feedback: 'yes' | 'no' | null; feedback_customers: number | null; discount_percent: number }[];
  feedback: { yes: number | null; no: number | null; customers: number };
}

const DEVICE: Record<string, { label: string; icon: typeof Smartphone }> = {
  mobile: { label: 'נייד', icon: Smartphone },
  desktop: { label: 'מחשב', icon: Monitor },
  tablet: { label: 'טאבלט', icon: Tablet },
};

export default function StatsPage() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, loading } = useApi<Stats>(`/business/stats?days=${days}`);
  const series = fillDays(data?.series ?? [], Number(days), { views: 0, phone: 0, waze: 0, share: 0 });
  const sum = (k: 'views' | 'phone' | 'waze' | 'share') => series.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const views = sum('views');
  const clicks = sum('phone') + sum('waze');
  const ctr = views ? Math.round((clicks / views) * 1000) / 10 : 0;
  const yes = data?.feedback.yes ?? 0;
  const no = data?.feedback.no ?? 0;
  const deviceTotal = (data?.devices ?? []).reduce((a, d) => a + d.value, 0);

  const axis = { tick: { fill: CHART_LIGHT.axis, fontSize: 11 }, axisLine: false, tickLine: false } as const;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="סטטיסטיקות"
        subtitle="כמה אנשים ראו את הדילים שלך ופעלו"
        icon={<BarChart3 size={22} />}
        actions={
          <Tabs<'7' | '30' | '90'>
            value={days}
            onChange={setDays}
            tabs={[
              { value: '7', label: '7 ימים' },
              { value: '30', label: '30 יום' },
              { value: '90', label: '90 יום' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="צפיות בדילים" value={loading ? '…' : compact(views)} icon={<Eye size={22} />} tone="sky" />
        <StatTile label="חיוגים" value={loading ? '…' : num(sum('phone'))} icon={<Phone size={22} />} tone="lime" />
        <StatTile label="ניווטים ב-Waze" value={loading ? '…' : num(sum('waze'))} icon={<Navigation size={22} />} tone="leaf" />
        <StatTile label="אחוז הקלקה" value={loading ? '…' : `${ctr}%`} icon={<MousePointerClick size={22} />} tone="wood" hint={`${num(sum('share'))} שיתופים`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="צפיות בדילים" subtitle="כמה פעמים נפתחו הכרטיסים שלך">
          <div className="relative h-64" dir="ltr">
            <NoDataOverlay show={!loading && views === 0} text="עדיין אין צפיות בתקופה הזו" />
            {loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES_LIGHT[0]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={SERIES_LIGHT[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_LIGHT.grid} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} reversed minTickGap={16} {...axis} />
                  <YAxis orientation="right" allowDecimals={false} width={40} {...axis} />
                  <Tooltip content={<ChartTooltip labelFormatter={shortDay} />} cursor={{ stroke: CHART_LIGHT.axis, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="views" name="צפיות" stroke={SERIES_LIGHT[0]} strokeWidth={2} fill="url(#stViews)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="פעולות של לקוחות" subtitle="לחיצות על חיוג וניווט, לפי יום">
          <Legend
            items={[
              { label: 'חיוג', color: SERIES_LIGHT[0], value: num(sum('phone')) },
              { label: 'Waze', color: SERIES_LIGHT[1], value: num(sum('waze')) },
            ]}
          />
          <div className="relative mt-3 h-56" dir="ltr">
            <NoDataOverlay show={!loading && clicks === 0} text="עדיין אין לחיצות בתקופה הזו" />
            {loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_LIGHT.grid} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} reversed minTickGap={16} {...axis} />
                  <YAxis orientation="right" allowDecimals={false} width={40} {...axis} />
                  <Tooltip content={<ChartTooltip labelFormatter={shortDay} />} cursor={{ fill: 'rgba(30,92,46,.06)' }} />
                  <Bar dataKey="phone" name="חיוג" stackId="a" fill={SERIES_LIGHT[0]} stroke="#fff" strokeWidth={1} maxBarSize={22} />
                  <Bar dataKey="waze" name="Waze" stackId="a" fill={SERIES_LIGHT[1]} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="מאיזה מכשיר צפו" subtitle="פילוח צפיות ולחיצות">
          {loading ? (
            <Skeleton className="h-40" />
          ) : !deviceTotal ? (
            <p className="py-8 text-center text-sm text-ink-500">אין עדיין נתונים</p>
          ) : (
            <ul className="space-y-4">
              {data!.devices.map((d) => {
                const meta = DEVICE[d.label] ?? { label: d.label || 'אחר', icon: Monitor };
                const pct = Math.round((d.value / deviceTotal) * 100);
                return (
                  <li key={d.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-semibold text-ink-800">
                        <meta.icon size={16} className="text-ink-400" /> {meta.label}
                      </span>
                      <span className="tabular-nums text-ink-600">
                        <b className="text-ink-900">{pct}%</b> · {num(d.value)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SERIES_LIGHT[0] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="האם הפרסומים עזרו?" subtitle="לפי המשובים שנתת אחרי כל דיל">
          {loading ? (
            <Skeleton className="h-40" />
          ) : yes + no === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">עוד אין משובים</p>
          ) : (
            <div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-display text-5xl text-leaf-700">{Math.round((yes / (yes + no)) * 100)}%</div>
                  <div className="text-sm text-ink-500">מהדילים הביאו לקוחות</div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-100 text-lime-700 shadow-inner-top">
                  <Users size={26} />
                </div>
              </div>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full" style={{ width: `${(yes / (yes + no)) * 100}%`, background: SERIES_LIGHT[0] }} />
                <div className="h-full border-r-2 border-white" style={{ width: `${(no / (yes + no)) * 100}%`, background: '#c47643' }} />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-ink-700">
                  <ThumbsUp size={15} className="text-lime-700" /> עזר: <b>{yes}</b>
                </span>
                <span className="flex items-center gap-1.5 text-ink-700">
                  <ThumbsDown size={15} className="text-wood-600" /> לא עזר: <b>{no}</b>
                </span>
              </div>
              {data!.feedback.customers > 0 && (
                <p className="mt-4 rounded-xl bg-lime-50 px-3 py-2 text-sm text-lime-900 ring-1 ring-lime-200">
                  סה״כ כ-<b>{num(data!.feedback.customers)}</b> לקוחות הגיעו בזכות הדילים 💪
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel title="סיכום התקופה">
          <ul className="space-y-3 text-sm">
            {[
              { icon: <Eye size={16} />, label: 'צפיות', value: num(views) },
              { icon: <Phone size={16} />, label: 'חיוגים', value: num(sum('phone')) },
              { icon: <Navigation size={16} />, label: 'ניווטים', value: num(sum('waze')) },
              { icon: <Share2 size={16} />, label: 'שיתופים', value: num(sum('share')) },
              { icon: <MousePointerClick size={16} />, label: 'יחס הקלקה', value: `${ctr}%` },
            ].map((r) => (
              <li key={r.label} className="flex items-center justify-between rounded-xl bg-ink-50/70 px-3 py-2.5 ring-1 ring-ink-100">
                <span className="flex items-center gap-2 text-ink-600">
                  <span className="text-ink-400">{r.icon}</span>
                  {r.label}
                </span>
                <b className="tabular-nums text-ink-900">{r.value}</b>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-6" title="הדילים המובילים בתקופה" padded={false}>
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-40" />
          </div>
        ) : !data?.deals.length ? (
          <Empty icon={<BarChart3 size={28} />} title="אין דילים שהסתיימו בתקופה" text="דילים שהסתיימו יופיעו כאן עם הביצועים שלהם." />
        ) : (
          <div className="overflow-x-auto">
            <table className="l-table">
              <thead>
                <tr>
                  <th>דיל</th>
                  <th>הנחה</th>
                  <th>הסתיים</th>
                  <th>צפיות</th>
                  <th>חיוג</th>
                  <th>Waze</th>
                  <th>משוב</th>
                </tr>
              </thead>
              <tbody>
                {data.deals.map((d) => (
                  <tr key={d.id}>
                    <td className="max-w-[280px] truncate font-semibold">{d.title}</td>
                    <td>{Math.round(d.discount_percent)}%</td>
                    <td className="whitespace-nowrap text-ink-500">{date(d.ended_at)}</td>
                    <td className="font-bold tabular-nums">{num(d.views)}</td>
                    <td className="tabular-nums">{d.clicks_phone}</td>
                    <td className="tabular-nums">{d.clicks_waze}</td>
                    <td>{d.feedback === 'yes' ? `👍 ${d.feedback_customers ?? ''}` : d.feedback === 'no' ? '👎' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
