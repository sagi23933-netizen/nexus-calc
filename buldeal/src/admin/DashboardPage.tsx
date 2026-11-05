import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity, Banknote, Bot, Building2, CalendarClock, Eye, LayoutDashboard, LifeBuoy, PlayCircle, Radio, ThumbsUp, Ticket, Hourglass, Ban, ArrowLeft, Bell,
} from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useApi } from '../lib/hooks';
import { compact, money, num, relative, shortDay, daysLeft, dateTime } from '../lib/format';
import type { Deal, Notification } from '../lib/types';
import { SERIES_DARK } from '../shared/charts';
import { Avatar, Button, Empty, Skeleton, StatusBadge, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { DealCard } from '../shared/DealCard';
import { Legend, PageHeader, Panel, StatTile } from './kit';
import { RtlTooltip, axisProps, cursorBar, cursorLine, fillDays, gridProps } from './core/charts';
import { SourceBadge } from './core/shared';

interface DashboardData {
  biz: { total: number; trial: number; active: number; past_due: number; blocked: number; suspended: number; new_week: number };
  deals: { live: number; scheduled: number; ending_soon: number };
  revenue: { month: number; week: number; total: number; mrr: number };
  visits: { today: number; week: number; visitors_week: number; live: number };
  feedback: { yes: number; no: number; pending: number };
  series: { day: string; views: number; visitors: number; clicks: number }[];
  revenueSeries: { day: string; amount: number }[];
  trialsEnding: { id: number; name: string; trial_ends_at: string; package_name: string | null }[];
  recentBusinesses: { id: number; name: string; status: string; source: 'site' | 'admin'; created_at: string; logo_url: string; category: string; city: string }[];
  topDeals: Deal[];
  openTickets: number;
  notifications: Notification[];
  ai: { calls: number; ok: number };
}

const STATUS_ROWS: { key: keyof DashboardData['biz']; label: string; color: string }[] = [
  { key: 'active', label: 'פעילים', color: '#0ca30c' },
  { key: 'trial', label: 'בתקופת ניסיון', color: '#3987e5' },
  { key: 'past_due', label: 'ממתינים לתשלום', color: '#fab219' },
  { key: 'blocked', label: 'חסומים', color: '#d03b3b' },
  { key: 'suspended', label: 'מושעים', color: '#81917b' },
];

export default function DashboardPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<DashboardData>('/admin/dashboard');
  const [running, setRunning] = useState(false);

  const runJobs = async () => {
    setRunning(true);
    try {
      const r = await api.post<Record<string, number | string>>('/admin/system/run-jobs');
      const parts = [
        r.expired ? `${r.expired} דילים פגו` : null,
        r.activated ? `${r.activated} דילים עלו` : null,
        r.trialWarnings ? `${r.trialWarnings} התראות ניסיון` : null,
        r.trialBlocked ? `${r.trialBlocked} עסקים נחסמו` : null,
      ].filter(Boolean);
      toast(parts.length ? `המשימות רצו: ${parts.join(' · ')}` : 'המשימות המתוזמנות רצו — אין שינויים');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setRunning(false);
    }
  };

  const header = (
    <PageHeader
      title="דשבורד ניהול"
      subtitle="תמונת מצב חיה של בולדיל — עסקים, דילים, כניסות והכנסות"
      icon={<LayoutDashboard size={22} />}
      actions={
        <Button variant="a-outline" size="sm" icon={<PlayCircle size={16} />} loading={running} onClick={runJobs}>
          הרצת משימות מתוזמנות
        </Button>
      }
    />
  );

  if (error) return <>{header}<Panel><Empty dark title="שגיאה בטעינת הדשבורד" text={error} action={<Button onClick={reload}>נסו שוב</Button>} /></Panel></>;
  if (loading || !data) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-32 !rounded-3xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-80 !rounded-3xl" />
      </>
    );
  }

  const series = fillDays(data.series, 30, ['views', 'visitors', 'clicks']);
  const revenue = fillDays(data.revenueSeries, 30, ['amount']);
  const fbTotal = (data.feedback.yes || 0) + (data.feedback.no || 0);
  const yesRate = fbTotal ? Math.round(((data.feedback.yes || 0) / fbTotal) * 100) : 0;
  const aiOk = data.ai.calls ? Math.round(((data.ai.ok || 0) / data.ai.calls) * 100) : 100;
  const revenue30 = revenue.reduce((a, r) => a + r.amount, 0);

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="עסקים במערכת" value={num(data.biz.total)} icon={<Building2 size={20} />} hint={`+${data.biz.new_week || 0} השבוע`} />
        <StatTile label="דילים באוויר" value={num(data.deals.live)} tone="wood" icon={<Ticket size={20} />} hint={`${data.deals.ending_soon || 0} מסתיימים ב-6 שעות`} />
        <StatTile label="הכנסות החודש" value={money(data.revenue.month)} tone="amber" icon={<Banknote size={20} />} hint={`MRR ${money(Math.round(data.revenue.mrr))}`} />
        <StatTile label="כניסות היום" value={num(data.visits.today || 0)} tone="sky" icon={<Eye size={20} />} hint={`${compact(data.visits.week || 0)} השבוע · ${num(data.visits.visitors_week || 0)} מבקרים`} />
        <StatTile
          label="גולשים עכשיו"
          value={
            <span className="flex items-center gap-2">
              {num(data.visits.live)}
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-400" />
              </span>
            </span>
          }
          tone="lime"
          icon={<Radio size={20} />}
          hint="5 הדקות האחרונות"
        />
        <StatTile label="משוב: הפרסום עזר" value={`${yesRate}%`} tone="violet" icon={<ThumbsUp size={20} />} hint={`${fbTotal} תשובות · ${data.feedback.pending || 0} ממתינות`} />
        <StatTile label="פניות פתוחות" value={num(data.openTickets)} tone={data.openTickets ? 'red' : 'lime'} icon={<LifeBuoy size={20} />} hint={<Link to="/admin/support" className="text-lime-300 hover:underline">למרכז הפניות</Link>} />
        <StatTile label="קריאות AI (7 ימים)" value={num(data.ai.calls || 0)} tone="sky" icon={<Bot size={20} />} hint={`${aiOk}% הצלחה`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="כניסות לאתר — 30 ימים"
          subtitle="צפיות בעמודים ומבקרים ייחודיים ליום"
          actions={
            <Legend
              items={[
                { label: 'צפיות', color: SERIES_DARK[0], value: compact(series.reduce((a, r) => a + r.views, 0)) },
                { label: 'מבקרים', color: SERIES_DARK[1], value: compact(series.reduce((a, r) => a + r.visitors, 0)) },
              ]}
            />
          }
        >
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_DARK[0]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={SERIES_DARK[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} tickFormatter={shortDay} minTickGap={24} />
                <YAxis {...axisProps} width={44} allowDecimals={false} />
                <Tooltip content={<RtlTooltip />} cursor={cursorLine} />
                <Area type="monotone" dataKey="views" name="צפיות" stroke={SERIES_DARK[0]} strokeWidth={2} fill="url(#gViews)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#101a14' }} />
                <Area type="monotone" dataKey="visitors" name="מבקרים" stroke={SERIES_DARK[1]} strokeWidth={2} fill="transparent" activeDot={{ r: 5, strokeWidth: 2, stroke: '#101a14' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="מצב העסקים" subtitle={`${num(data.biz.total)} עסקים רשומים`}>
          <div className="space-y-4">
            {STATUS_ROWS.map((s) => {
              const v = Number(data.biz[s.key]) || 0;
              const pct = data.biz.total ? (v / data.biz.total) * 100 : 0;
              return (
                <Link key={s.key} to={`/admin/businesses?status=${s.key}`} className="block rounded-xl p-1 transition hover:bg-white/5">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-200">
                      <StatusBadge status={s.key} dark label={s.label} />
                    </span>
                    <span className="font-bold tabular-nums text-white">
                      {v} <span className="text-xs font-normal text-ink-500">({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, v ? 2 : 0)}%`, background: s.color }} />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/5 pt-5">
            <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/5">
              <div className="text-[11px] text-ink-400">הכנסות מצטברות</div>
              <div className="mt-0.5 text-lg font-black text-white">{money(data.revenue.total)}</div>
            </div>
            <div className="rounded-2xl bg-black/20 p-3 ring-1 ring-white/5">
              <div className="text-[11px] text-ink-400">השבוע</div>
              <div className="mt-0.5 text-lg font-black text-white">{money(data.revenue.week)}</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="הכנסות יומיות — 30 ימים" subtitle={`סה״כ ${money(revenue30)} בתקופה`}>
          <div className="h-60" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} tickFormatter={shortDay} minTickGap={24} />
                <YAxis {...axisProps} width={52} tickFormatter={(v) => `₪${compact(v)}`} />
                <Tooltip content={<RtlTooltip valueFormatter={(v) => money(v)} />} cursor={cursorBar} />
                <Bar dataKey="amount" name="הכנסות" fill={SERIES_DARK[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="תקופות ניסיון שמסתיימות" subtitle="לפי מועד סיום" bodyClass="!p-0" actions={<Hourglass size={16} className="text-ink-400" />}>
          {data.trialsEnding.length === 0 ? (
            <Empty dark title="אין עסקים בתקופת ניסיון" />
          ) : (
            <ul>
              {data.trialsEnding.map((t) => {
                const d = daysLeft(t.trial_ends_at);
                return (
                  <li key={t.id}>
                    <Link to={`/admin/businesses/${t.id}`} className="flex items-center gap-3 border-b border-white/5 px-5 py-3 transition hover:bg-white/5">
                      <span className={cx('flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-center font-black leading-none', d <= 1 ? 'bg-red-500/15 text-red-300' : 'bg-sky-400/10 text-sky-300')}>
                        <span className="text-base">{d}</span>
                        <span className="text-[9px] font-semibold">ימים</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">{t.name}</span>
                        <span className="block text-[11px] text-ink-400">
                          {t.package_name ? `חבילה נבחרת: ${t.package_name}` : 'טרם נבחרה חבילה'} · {dateTime(t.trial_ends_at)}
                        </span>
                      </span>
                      <ArrowLeft size={15} className="text-ink-500" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="הדילים החמים באוויר" subtitle="לפי צפיות ולחיצות" actions={<Link to="/admin/deals" className="text-sm font-semibold text-lime-300 hover:underline">לכל הדילים</Link>}>
          {data.topDeals.length === 0 ? (
            <Empty dark icon={<Ticket size={26} />} title="אין דילים באוויר כרגע" />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {data.topDeals.slice(0, 3).map((d) => (
                <DealCard key={d.id} deal={d} preview showStats />
              ))}
            </div>
          )}
          {data.topDeals.length > 3 && (
            <div className="mt-5 space-y-2">
              {data.topDeals.slice(3).map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-2.5 ring-1 ring-white/5">
                  <Avatar src={d.business.logo_url} name={d.business.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{d.title}</div>
                    <div className="text-[11px] text-ink-400">{d.business.name}</div>
                  </div>
                  <span className="text-xs text-ink-300">
                    <Eye size={12} className="inline" /> {d.views} · <Activity size={12} className="inline" /> {(d.clicks_phone ?? 0) + (d.clicks_waze ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="עסקים חדשים" bodyClass="!p-0" actions={<Link to="/admin/businesses" className="text-sm font-semibold text-lime-300 hover:underline">לכולם</Link>}>
            <ul>
              {data.recentBusinesses.map((b) => (
                <li key={b.id}>
                  <Link to={`/admin/businesses/${b.id}`} className="flex items-center gap-3 border-b border-white/5 px-5 py-3 transition hover:bg-white/5">
                    <Avatar src={b.logo_url} name={b.name} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{b.name}</span>
                      <span className="block truncate text-[11px] text-ink-400">
                        {[b.category, b.city].filter(Boolean).join(' · ')} · {relative(b.created_at)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <StatusBadge status={b.status} dark />
                      <SourceBadge source={b.source} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="התראות אחרונות" bodyClass="!p-0" actions={<Link to="/admin/notifications" className="text-sm font-semibold text-lime-300 hover:underline">לכולן</Link>}>
            {data.notifications.length === 0 ? (
              <Empty dark icon={<Bell size={24} />} title="אין התראות" />
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {data.notifications.slice(0, 8).map((n) => (
                  <li key={n.id} className="flex items-start gap-3 border-b border-white/5 px-5 py-3">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-white/15' : 'bg-lime-400')} />
                    <span className="min-w-0 flex-1">
                      {n.link ? (
                        <Link to={n.link} className="block truncate text-sm font-semibold text-white hover:text-lime-300">
                          {n.title}
                        </Link>
                      ) : (
                        <span className="block truncate text-sm font-semibold text-white">{n.title}</span>
                      )}
                      <span className="text-[11px] text-ink-500">
                        <CalendarClock size={11} className="inline" /> {relative(n.created_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {(data.biz.blocked > 0 || data.biz.past_due > 0) && (
            <Link to="/admin/businesses?status=blocked" className="a-card flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
                <Ban size={18} />
              </span>
              <span className="flex-1 text-sm">
                <b className="text-white">{data.biz.blocked} עסקים חסומים</b>
                <span className="block text-xs text-ink-400">{data.biz.past_due} ממתינים לתשלום · כדאי ליצור קשר</span>
              </span>
              <ArrowLeft size={16} className="text-ink-500" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
