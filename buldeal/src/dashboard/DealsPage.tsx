import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleStop, ExternalLink, Eye, History, LayoutGrid, MapPin, MessageSquareHeart, Navigation, Phone, Plus, ThumbsDown, ThumbsUp, Wand2, Users } from 'lucide-react';
import { api, errMsg, qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import type { Deal, HistoryItem } from '../lib/types';
import { dateTime, durationLabel, END_REASON, money } from '../lib/format';
import { DealCard } from '../shared/DealCard';
import { Button, Confirm, Empty, Pagination, Skeleton, StatusBadge, Tabs, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { DEAL_DEFAULTS, PageHeader, useBootstrap } from './kit';
import { FeedbackModal } from './FeedbackModal';

type Tab = 'live' | 'history' | 'pending';

function LiveDeal({ deal, onChange, onEnded, freeRedesigns }: { deal: Deal; onChange: (d: Deal) => void; onEnded: () => void; freeRedesigns: number }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const left = Math.max(0, freeRedesigns - (deal.redesigns ?? 0));

  const patch = async (key: 'show_phone' | 'show_address' | 'show_waze', value: boolean) => {
    setBusy(key);
    try {
      const res = await api.patch<{ deal: Deal }>(`/business/deals/${deal.id}`, { [key]: value });
      onChange(res.deal);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const redesign = async () => {
    setBusy('redesign');
    try {
      const res = await api.post<{ deal: Deal }>(`/business/deals/${deal.id}/redesign`);
      onChange(res.deal);
      toast('עיצוב חדש מוכן ✨');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const end = async () => {
    setBusy('end');
    try {
      await api.del(`/business/deals/${deal.id}`);
      toast('הדיל הוסר מהאתר');
      setConfirm(false);
      onEnded();
      refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col gap-3">
      <div className="relative">
        {deal.status === 'scheduled' && (
          <div className="absolute -top-3 left-1/2 z-40 -translate-x-1/2">
            <StatusBadge status="scheduled" label={`מתוזמן · ${dateTime(deal.starts_at)}`} />
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={JSON.stringify(deal.design)} initial={{ rotateY: 80, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -80, opacity: 0 }} transition={{ duration: 0.35 }} style={{ transformPerspective: 1200 }}>
            <DealCard deal={deal} showStats preview />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="card-3d space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span>
            {durationLabel(deal.duration_hours)} · עד {dateTime(deal.expires_at)}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={13} /> {deal.views}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['show_phone', <Phone key="p" size={15} />, 'טלפון'],
              ['show_address', <MapPin key="a" size={15} />, 'כתובת'],
              ['show_waze', <Navigation key="w" size={15} />, 'Waze'],
            ] as const
          ).map(([key, icon, label]) => {
            const on = !!deal[key];
            return (
              <button
                key={key}
                disabled={busy === key}
                onClick={() => patch(key, !on)}
                className={cx('flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold ring-1 transition', on ? 'bg-lime-50 text-lime-800 ring-lime-200' : 'bg-ink-50 text-ink-400 ring-ink-100 line-through')}
                title={on ? `הסתרת ${label}` : `הצגת ${label}`}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={redesign} loading={busy === 'redesign'} disabled={left <= 0} icon={<Wand2 size={15} />}>
            {left > 0 ? `עיצוב מחדש (${left})` : 'אין עיצובים'}
          </Button>
          <a href={`/deal/${deal.id}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" aria-label="צפייה באתר">
            <ExternalLink size={15} />
          </a>
          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirm(true)} icon={<CircleStop size={15} />}>
            סיום
          </Button>
        </div>
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={end}
        loading={busy === 'end'}
        danger
        title="להוריד את הדיל מהאתר?"
        body={
          <>
            הדיל <b>{deal.title}</b> יוסר מיד מהאתר. הטוקן שנוצל לא יוחזר.
          </>
        }
        confirmText="כן, להוריד"
      />
    </motion.div>
  );
}

function FeedbackCell({ h, onAsk }: { h: HistoryItem; onAsk: () => void }) {
  if (h.feedback === 'yes')
    return (
      <span className="chip bg-lime-50 text-lime-800 ring-1 ring-lime-200">
        <ThumbsUp size={12} /> עזר{h.feedback_customers != null ? ` · ${h.feedback_customers} לקוחות` : ''}
      </span>
    );
  if (h.feedback === 'no')
    return (
      <span className="chip bg-wood-50 text-wood-700 ring-1 ring-wood-200">
        <ThumbsDown size={12} /> לא עזר
      </span>
    );
  if (h.end_reason !== 'expired') return <span className="text-xs text-ink-400">—</span>;
  return (
    <Button size="sm" onClick={onAsk} icon={<MessageSquareHeart size={14} />}>
      לענות
    </Button>
  );
}

function HistoryList({ filter }: { filter?: 'pending' }) {
  const { me } = useAuth();
  const [page, setPage] = useState(1);
  const [ask, setAsk] = useState<HistoryItem | null>(null);
  const { data, loading, reload } = useApi<{ items: HistoryItem[]; total: number }>(`/business/history${qs({ page, size: 20, filter })}`);
  const pending = me.business?.counts.pending_feedback;

  useEffect(() => {
    reload();
  }, [pending, reload]);

  if (loading && !data) return <Skeleton className="h-64" />;
  if (!data?.items.length)
    return (
      <div className="card-3d">
        <Empty icon={filter ? <MessageSquareHeart size={28} /> : <History size={28} />} title={filter ? 'אין דילים שממתינים למשוב' : 'עוד אין היסטוריה'} text={filter ? 'כל הכבוד — עניתם על הכל 🎉' : 'דילים שהסתיימו יופיעו כאן עם כל הנתונים.'} />
      </div>
    );

  return (
    <>
      {/* desktop table */}
      <div className="card-3d hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="l-table">
            <thead>
              <tr>
                <th>דיל</th>
                <th>מחיר</th>
                <th>תקופה</th>
                <th>צפיות</th>
                <th>חיוג</th>
                <th>Waze</th>
                <th>סיום</th>
                <th>האם עזר?</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((h) => (
                <tr key={h.id} className="transition hover:bg-lime-50/40">
                  <td className="max-w-[260px]">
                    <div className="truncate font-semibold text-ink-900">{h.title}</div>
                    <div className="text-xs text-ink-400">{durationLabel(h.duration_hours)}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    <b>{money(h.final_price)}</b> <s className="text-xs text-ink-400">{money(h.original_price)}</s>
                    <div className="text-xs text-lime-700">{Math.round(h.discount_percent)}%</div>
                  </td>
                  <td className="whitespace-nowrap text-xs text-ink-500">
                    {dateTime(h.started_at)}
                    <br />
                    {dateTime(h.ended_at)}
                  </td>
                  <td className="font-semibold tabular-nums">{h.views}</td>
                  <td className="tabular-nums">{h.clicks_phone}</td>
                  <td className="tabular-nums">{h.clicks_waze}</td>
                  <td className="whitespace-nowrap text-xs text-ink-500">{END_REASON[h.end_reason]}</td>
                  <td>
                    <FeedbackCell h={h} onAsk={() => setAsk(h)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={data.total} size={20} onPage={setPage} />
      </div>
      {/* mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.items.map((h) => (
          <div key={h.id} className="card-3d p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-bold">{h.title}</div>
                <div className="text-xs text-ink-500">{dateTime(h.ended_at)} · {END_REASON[h.end_reason]}</div>
              </div>
              <div className="text-left">
                <div className="font-black">{money(h.final_price)}</div>
                <s className="text-xs text-ink-400">{money(h.original_price)}</s>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-ink-50 py-2">
                <div className="text-ink-500">צפיות</div>
                <b className="text-base">{h.views}</b>
              </div>
              <div className="rounded-xl bg-ink-50 py-2">
                <div className="text-ink-500">חיוג</div>
                <b className="text-base">{h.clicks_phone}</b>
              </div>
              <div className="rounded-xl bg-ink-50 py-2">
                <div className="text-ink-500">Waze</div>
                <b className="text-base">{h.clicks_waze}</b>
              </div>
            </div>
            <div className="mt-3">
              <FeedbackCell h={h} onAsk={() => setAsk(h)} />
            </div>
          </div>
        ))}
        <Pagination page={page} total={data.total} size={20} onPage={setPage} />
      </div>
      <FeedbackModal
        item={ask}
        onClose={() => setAsk(null)}
        onDone={() => {
          setAsk(null);
          reload();
        }}
      />
    </>
  );
}

export default function DealsPage() {
  const { me, refresh } = useAuth();
  const boot = useBootstrap();
  const freeRedesigns = (boot?.settings.deals ?? DEAL_DEFAULTS).freeRedesigns;
  const [tab, setTab] = useState<Tab>('live');
  const { data, loading, reload, setData } = useApi<{ deals: Deal[] }>('/business/deals');
  const counts = me.business?.counts;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="הדילים שלי"
        subtitle="ניהול הדילים שבאוויר, היסטוריה ומשובים"
        icon={<LayoutGrid size={22} />}
        actions={
          <Link to="/dashboard/new" className="btn btn-lime">
            <Plus size={18} strokeWidth={3} /> דיל חדש
          </Link>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        className="mb-6"
        tabs={[
          { value: 'live', label: 'באוויר עכשיו', count: data?.deals.length ?? counts?.live_deals },
          { value: 'history', label: 'היסטוריה', count: counts?.past_deals },
          { value: 'pending', label: 'ממתינים למשוב', count: counts?.pending_feedback },
        ]}
      />

      {tab === 'live' &&
        (loading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[560px] rounded-[28px]" />
            ))}
          </div>
        ) : !data?.deals.length ? (
          <div className="card-3d">
            <Empty
              icon={<LayoutGrid size={28} />}
              title="אין דילים באוויר כרגע"
              text="דיל בזק מושך לקוחות תוך שעות. בואו נעלה אחד!"
              action={
                <Link to="/dashboard/new" className="btn btn-lime">
                  <Plus size={18} /> פרסום דיל
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {data.deals.map((d) => (
                <LiveDeal
                  key={d.id}
                  deal={d}
                  freeRedesigns={freeRedesigns}
                  onChange={(nd) => setData((cur) => (cur ? { deals: cur.deals.map((x) => (x.id === nd.id ? nd : x)) } : cur))}
                  onEnded={() => {
                    reload();
                    refresh();
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        ))}

      {tab === 'history' && <HistoryList key="h" />}
      {tab === 'pending' && <HistoryList key="p" filter="pending" />}

      {tab !== 'live' && (
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
          <Users size={14} /> המשוב שלכם עוזר לנו להבין אילו דילים מביאים לקוחות — ולשפר את החשיפה.
        </p>
      )}
    </div>
  );
}
