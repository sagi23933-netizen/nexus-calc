import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, Bell, Coins, Eye, LayoutGrid, MessageSquareHeart, MousePointerClick, Plus, Rocket, Sparkles, Users } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { BusinessInfo, Deal, Notification } from '../lib/types';
import { compact, daysLeft, money, num, periodLabel, relative, shortDay, STATUS_LABEL, date } from '../lib/format';
import { DealCard } from '../shared/DealCard';
import { Empty, Skeleton, cx } from '../shared/ui';
import { CHART_LIGHT, SERIES_LIGHT } from '../shared/charts';
import { ChartTooltip, Legend, NoDataOverlay, Panel, StatTile } from './kit';
import { fillDays } from './chartUtils';

interface Overview {
  business: BusinessInfo;
  live: Deal[];
  totals: { views: number; phone: number; waze: number; deals: number; helped: number | null; answered: number | null; customers: number };
  series: { day: string; views: number; phone: number; waze: number }[];
  pendingFeedback: { id: number; title: string; ended_at: string; views: number; clicks_phone: number; clicks_waze: number }[];
  notifications: Notification[];
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

export default function OverviewPage() {
  const { me, setBusiness } = useAuth();
  const { data, loading, reload } = useApi<Overview>('/business/overview');
  const pending = me.business?.counts.pending_feedback;
  const prevPending = useRef(pending);

  useEffect(() => {
    if (data?.business) setBusiness(data.business);
  }, [data, setBusiness]);

  // feedback answered elsewhere (modal in the layout) → refresh the pending list
  useEffect(() => {
    if (prevPending.current === pending) return;
    prevPending.current = pending;
    reload();
  }, [pending, reload]);

  const b = data?.business ?? me.business!;
  const series = fillDays(data?.series ?? [], 14, { views: 0, phone: 0, waze: 0 }).map((r) => ({ ...r, clicks: (r.phone || 0) + (r.waze || 0) }));
  const helpRate = data?.totals?.answered ? Math.round(((data.totals.helped || 0) / data.totals.answered) * 100) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* hero */}
      <motion.section
        initial={{ opacity: 0, rotateX: 8, y: 20 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        style={{ transformPerspective: 1400 }}
        className="relative overflow-hidden rounded-[32px] p-6 text-white shadow-deep sm:p-8"
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(125deg,#0b2a14 0%,#1e5c2e 45%,#4f9a1e 85%,#8cc10a 120%)' }} />
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-lime-300/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,.12)_1px,transparent_0)] bg-[length:22px_22px] opacity-60" />
        {/* floating 3D tokens */}
        <div aria-hidden className="pointer-events-none absolute left-6 top-1/2 hidden -translate-y-1/2 md:block">
          <div className="relative h-40 w-56">
            {[
              { e: '%', x: 10, y: 10, s: 64, d: '0s', bg: 'linear-gradient(160deg,#e8ff9a,#8cc10a 60%,#557a0c)' },
              { e: '₪', x: 120, y: 0, s: 52, d: '-1.5s', bg: 'linear-gradient(160deg,#fff3a6,#f5c518 60%,#c99a00)' },
              { e: '🔥', x: 70, y: 80, s: 58, d: '-3s', bg: 'linear-gradient(160deg,#ffd0b0,#c47643 60%,#8c3f18)' },
            ].map((t) => (
              <div
                key={t.e}
                className="absolute flex animate-floaty items-center justify-center rounded-2xl font-black text-leaf-950 shadow-3d"
                style={{ left: t.x, top: t.y, width: t.s, height: t.s, background: t.bg, animationDelay: t.d, fontSize: t.s * 0.45, transform: 'rotate(-8deg)' }}
              >
                {t.e}
              </div>
            ))}
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold text-lime-200">{greeting()} 👋</p>
          <h1 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">{b.name}</h1>
          <p className="mt-2 text-white/80">
            {b.counts.live_deals > 0
              ? `יש לך ${b.counts.live_deals} דילים באוויר עכשיו. רוצה להוסיף עוד אחד?`
              : 'אין לך דילים באוויר כרגע — זה הזמן להעלות דיל בזק ולמשוך לקוחות.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/dashboard/new" className="btn btn-lime btn-lg">
              <Plus size={22} strokeWidth={3} /> פרסום דיל חדש
            </Link>
            <Link to={`/b/${b.slug}`} target="_blank" className="btn btn-lg border border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20">
              הדף שלי באתר
            </Link>
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="טוקנים זמינים" value={b.tokens.available} icon={<Coins size={22} />} tone="amber" hint={b.tokens.daily ? `כולל ${b.tokens.daily} טוקן יומי` : `${b.tokens.balance} ביתרה`} />
        <StatTile label="דילים באוויר" value={b.counts.live_deals} icon={<LayoutGrid size={22} />} tone="lime" hint={`${num(b.counts.past_deals)} דילים בעבר`} />
        <StatTile label="צפיות בדילים" value={loading ? '…' : compact(data?.totals.views ?? 0)} icon={<Eye size={22} />} tone="sky" hint="מכל הזמנים" />
        <StatTile
          label="חיוגים + ניווטים"
          value={loading ? '…' : compact((data?.totals.phone ?? 0) + (data?.totals.waze ?? 0))}
          icon={<MousePointerClick size={22} />}
          tone="wood"
          hint={helpRate != null ? `${helpRate}% מהדילים עזרו` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="ביצועים ב-14 הימים האחרונים"
          subtitle="צפיות בדילים ולחיצות (חיוג + Waze)"
          actions={
            <Link to="/dashboard/stats" className="btn btn-sm btn-ghost">
              עוד נתונים <ArrowLeft size={15} />
            </Link>
          }
        >
          <Legend
            items={[
              { label: 'צפיות', color: SERIES_LIGHT[0], value: num(series.reduce((a, r) => a + (r.views || 0), 0)) },
              { label: 'לחיצות', color: SERIES_LIGHT[1], value: num(series.reduce((a, r) => a + r.clicks, 0)) },
            ]}
          />
          <div className="relative mt-3 h-64" dir="ltr">
            <NoDataOverlay show={!loading && series.every((r) => !r.views && !r.clicks)} text="הנתונים יופיעו כאן ברגע שלקוחות יצפו בדילים" />
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ovViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES_LIGHT[0]} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={SERIES_LIGHT[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART_LIGHT.grid} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: CHART_LIGHT.axis, fontSize: 11 }} axisLine={false} tickLine={false} reversed minTickGap={14} />
                  <YAxis orientation="right" allowDecimals={false} tick={{ fill: CHART_LIGHT.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip labelFormatter={shortDay} />} cursor={{ stroke: CHART_LIGHT.axis, strokeDasharray: '4 4' }} />
                  <Area type="monotone" dataKey="views" name="צפיות" stroke={SERIES_LIGHT[0]} strokeWidth={2} fill="url(#ovViews)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                  <Line type="monotone" dataKey="clicks" name="לחיצות" stroke={SERIES_LIGHT[1]} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        {/* package card */}
        <section className="card-3d relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-lime-200/50 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink-900">החבילה שלי</h2>
              <span className={cx('chip', b.status === 'active' ? 'bg-lime-100 text-lime-800' : b.status === 'trial' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800')}>{STATUS_LABEL[b.status]}</span>
            </div>
            {b.package ? (
              <>
                <div className="mt-4 font-display text-3xl text-leaf-800">{b.package.name}</div>
                <div className="text-sm text-ink-500">
                  {money(b.package.price)} {periodLabel(b.package.period)} · {b.package.tokens} טוקנים
                </div>
              </>
            ) : (
              <p className="mt-4 text-ink-600">עוד לא נבחרה חבילה.</p>
            )}
            <div className="mt-5 space-y-3 rounded-2xl bg-ink-50/80 p-4 ring-1 ring-ink-100">
              {b.status === 'trial' ? (
                <Row label="סיום תקופת הניסיון" value={`${date(b.trial.ends_at)} (${daysLeft(b.trial.ends_at)} ימים)`} />
              ) : (
                <Row label="חידוש הבא" value={b.period_end ? date(b.period_end) : '—'} />
              )}
              <Row label="טוקנים ביתרה" value={String(b.tokens.balance)} />
              {b.status === 'trial' && <Row label="טוקן יומי (ניסיון)" value={b.tokens.daily ? 'זמין היום ✓' : 'נוצל — חדש מחר'} />}
              <Row label="חידוש אוטומטי" value={b.auto_renew ? 'פעיל' : 'כבוי'} />
            </div>
            <Link to="/dashboard/billing" className="btn btn-leaf mt-5 w-full">
              <Rocket size={17} /> {b.status === 'trial' ? 'תשלום והפעלת החבילה' : 'ניהול חבילה וטוקנים'}
            </Link>
          </div>
        </section>
      </div>

      {/* live deals */}
      <Panel
        title="הדילים שבאוויר עכשיו"
        icon={<Sparkles size={17} />}
        actions={
          <Link to="/dashboard/deals" className="btn btn-sm btn-ghost">
            לכל הדילים <ArrowLeft size={15} />
          </Link>
        }
      >
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[470px] rounded-[28px]" />
            ))}
          </div>
        ) : data?.live?.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.live.slice(0, 3).map((d) => (
              <DealCard key={d.id} deal={d} showStats preview />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Rocket size={28} />}
            title="אין דילים באוויר"
            text="דיל בזק מושך לקוחות תוך שעות. מעלים פרטים, ה-AI מעצב את הכרטיס — ואתם באוויר."
            action={
              <Link to="/dashboard/new" className="btn btn-lime">
                <Plus size={18} /> לפרסום הדיל הראשון
              </Link>
            }
          />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="מחכים למשוב שלך" icon={<MessageSquareHeart size={17} />} subtitle="האם הפרסום עזר והגיעו אנשים?">
          {!data ? (
            <Skeleton className="h-32" />
          ) : !data.pendingFeedback?.length ? (
            <p className="py-6 text-center text-sm text-ink-500">אין דילים שממתינים למשוב 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingFeedback.map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-ink-50/70 p-3 ring-1 ring-ink-100">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink-900">{h.title}</div>
                    <div className="text-xs text-ink-500">
                      הסתיים {relative(h.ended_at)} · {h.views} צפיות · {h.clicks_phone + h.clicks_waze} לחיצות
                    </div>
                  </div>
                  <Link to={`/dashboard/deals?feedback=${h.id}`} className="btn btn-sm btn-lime">
                    לענות
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data?.totals?.customers ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-lime-50 p-3 text-sm text-lime-900 ring-1 ring-lime-200">
              <Users size={18} /> לפי המשובים שלך, הדילים הביאו בערך <b>{num(data.totals.customers)}</b> לקוחות 💪
            </div>
          ) : null}
        </Panel>

        <Panel
          title="עדכונים אחרונים"
          icon={<Bell size={17} />}
          actions={
            <Link to="/dashboard/notifications" className="btn btn-sm btn-ghost">
              הכל <ArrowLeft size={15} />
            </Link>
          }
        >
          {!data ? (
            <Skeleton className="h-32" />
          ) : !data.notifications?.length ? (
            <p className="py-6 text-center text-sm text-ink-500">אין עדכונים</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.notifications.map((n) => (
                <li key={n.id} className="flex gap-3 py-2.5">
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-ink-200' : 'bg-lime-500')} />
                  <div className="min-w-0 flex-1">
                    {n.link ? (
                      <Link to={n.link} className="block truncate text-sm font-semibold text-ink-900 hover:text-leaf-700">
                        {n.title}
                      </Link>
                    ) : (
                      <div className="truncate text-sm font-semibold text-ink-900">{n.title}</div>
                    )}
                    <div className="text-[11px] text-ink-400">{relative(n.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}
