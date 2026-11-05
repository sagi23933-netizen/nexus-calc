import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, LayoutGrid, List, MousePointerClick, Search, Sparkles, Star, ThumbsDown, ThumbsUp, Ticket, Users, HelpCircle } from 'lucide-react';
import { qs } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { money, num } from '../lib/format';
import type { Deal, HistoryItem } from '../lib/types';
import { Avatar, Empty, Pagination, Skeleton, StatusBadge, Tabs, cx } from '../shared/ui';
import { DealCard } from '../shared/DealCard';
import { Countdown } from '../shared/Countdown';
import { PageHeader, Panel, StatTile } from './kit';
import { DealActions, HistoryTable } from './core/BizTabs';
import { TableWrap, useLookups, DSelect } from './core/shared';

function LiveDeals() {
  const { categories, cities } = useLookups();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const { data, loading, reload } = useApi<{ deals: Deal[] }>(`/admin/deals${qs({ q: dq, city, category })}`);
  const deals = data?.deals ?? [];
  const totals = deals.reduce((a, d) => ({ views: a.views + (d.views ?? 0), clicks: a.clicks + (d.clicks_phone ?? 0) + (d.clicks_waze ?? 0), ai: a.ai + (d.design_source === 'ai' ? 1 : 0) }), { views: 0, clicks: 0, ai: 0 });

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="דילים באוויר" value={num(deals.length)} icon={<Ticket size={20} />} />
        <StatTile label="צפיות בדילים" value={num(totals.views)} tone="sky" icon={<Eye size={20} />} />
        <StatTile label="לחיצות חיוג/ניווט" value={num(totals.clicks)} tone="amber" icon={<MousePointerClick size={20} />} />
        <StatTile label="עוצבו ב-AI" value={num(totals.ai)} tone="violet" icon={<Sparkles size={20} />} hint={deals.length ? `${Math.round((totals.ai / deals.length) * 100)}% מהדילים` : undefined} />
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input className="a-input !pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי כותרת או עסק" />
          </div>
          <DSelect className="!w-auto min-w-[140px]" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">כל הערים</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DSelect>
          <DSelect className="!w-auto min-w-[150px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DSelect>
          <div className="flex rounded-xl bg-black/30 p-1 ring-1 ring-white/5">
            {(['grid', 'table'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cx('rounded-lg p-2 transition', view === v ? 'bg-lime-400 text-leaf-950' : 'text-ink-400 hover:text-white')} aria-label={v === 'grid' ? 'תצוגת כרטיסים' : 'תצוגת טבלה'}>
                {v === 'grid' ? <LayoutGrid size={16} /> : <List size={16} />}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="grid gap-6 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[470px] !rounded-[28px]" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <Empty dark icon={<Ticket size={26} />} title="אין דילים באוויר" text="דילים שפורסמו יופיעו כאן עד שיפוגו (עד 48 שעות)" />
        ) : view === 'grid' ? (
          <div className="grid gap-x-6 gap-y-8 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {deals.map((d) => (
              <div key={d.id}>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <Link to={`/admin/businesses/${d.business.id}`} className="truncate font-semibold text-ink-300 hover:text-lime-300">
                    {d.business.name}
                  </Link>
                  {d.status === 'scheduled' ? <StatusBadge status="scheduled" dark /> : d.business_status && d.business_status !== 'active' && <StatusBadge status={d.business_status} dark />}
                </div>
                <DealCard deal={d} preview showStats />
                <DealActions deal={d} onChanged={reload} />
              </div>
            ))}
          </div>
        ) : (
          <TableWrap>
            <table className="a-table min-w-[1000px]">
              <thead>
                <tr>
                  <th>דיל</th>
                  <th>עסק</th>
                  <th>מחיר</th>
                  <th>נותר</th>
                  <th>צפיות</th>
                  <th>חיוג · ניווט</th>
                  <th>עיצוב</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id}>
                    <td className="max-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-9 w-9 shrink-0 rounded-xl text-center text-lg leading-9 shadow-3d"
                          style={{ background: `linear-gradient(135deg, ${d.design?.palette?.bg1 ?? '#1e5c2e'}, ${d.design?.palette?.bg2 ?? '#8cc10a'})` }}
                        >
                          {d.design?.emoji}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 truncate font-semibold text-white">
                            {d.featured && <Star size={13} className="shrink-0 fill-amber-300 text-amber-300" />}
                            {d.title}
                          </div>
                          <div className="text-xs text-ink-500">{[d.category?.name, d.city?.name].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link to={`/admin/businesses/${d.business.id}`} className="flex items-center gap-2 text-ink-200 hover:text-lime-300">
                        <Avatar src={d.business.logo_url} name={d.business.name} size={28} />
                        <span className="truncate">{d.business.name}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">
                      <s className="text-xs text-ink-500">{money(d.original_price)}</s> <b className="text-white">{money(d.final_price)}</b>
                      <div className="text-xs text-lime-300">{Math.round(d.discount_percent)}%</div>
                    </td>
                    <td className="font-mono text-ink-200">{d.status === 'scheduled' ? <StatusBadge status="scheduled" dark /> : <Countdown to={d.expires_at} />}</td>
                    <td className="tabular-nums text-ink-200">{d.views}</td>
                    <td className="tabular-nums text-ink-200">
                      {d.clicks_phone} · {d.clicks_waze}
                    </td>
                    <td>
                      <span className={cx('chip', d.design_source === 'ai' ? 'bg-violet-400/10 text-violet-300' : 'bg-white/5 text-ink-400')}>{d.design_source === 'ai' ? 'AI' : 'מובנה'}</span>
                    </td>
                    <td>
                      <DealActions deal={d} onChanged={reload} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}

function HistoryDeals() {
  const [feedback, setFeedback] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const [page, setPage] = useState(1);
  const { data, loading } = useApi<{ items: HistoryItem[]; total: number; page: number; size: number; summary: { yes: number; no: number; none: number; customers: number } }>(
    `/admin/deals/history${qs({ feedback, q: dq, page })}`,
  );
  const s = data?.summary;
  const answered = (s?.yes || 0) + (s?.no || 0);
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="הפרסום עזר" value={num(s?.yes || 0)} icon={<ThumbsUp size={20} />} hint={answered ? `${Math.round(((s?.yes || 0) / answered) * 100)}% מהעונים` : undefined} />
        <StatTile label="לא עזר" value={num(s?.no || 0)} tone="red" icon={<ThumbsDown size={20} />} />
        <StatTile label="ללא תשובה" value={num(s?.none || 0)} tone="amber" icon={<HelpCircle size={20} />} />
        <StatTile label="לקוחות שהגיעו (דיווח)" value={num(s?.customers || 0)} tone="sky" icon={<Users size={20} />} />
      </div>
      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="a-input !pr-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="חיפוש לפי כותרת או עסק"
            />
          </div>
          <DSelect
            className="!w-auto min-w-[170px]"
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              setPage(1);
            }}
          >
            <option value="">כל המשובים</option>
            <option value="yes">👍 הפרסום עזר</option>
            <option value="no">👎 לא עזר</option>
            <option value="none">ללא תשובה</option>
          </DSelect>
        </div>
        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <>
            <HistoryTable items={data?.items ?? []} showBusiness />
            {data && (
              <div className="border-t border-white/5 px-3">
                <Pagination dark page={page} total={data.total} size={data.size} onPage={setPage} />
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  );
}

export default function DealsPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'history' ? 'history' : 'live';
  return (
    <>
      <PageHeader
        title="דילים"
        subtitle="כל הדילים באוויר והיסטוריית הדילים שנמחקו אוטומטית — כולל משוב 'האם הפרסום עזר'"
        icon={<Ticket size={22} />}
        actions={
          <Tabs
            dark
            value={tab}
            onChange={(v) => setSp(v === 'live' ? {} : { tab: v }, { replace: true })}
            tabs={[
              { value: 'live', label: 'באוויר עכשיו' },
              { value: 'history', label: 'היסטוריה ומשוב' },
            ]}
          />
        }
      />
      {tab === 'live' ? <LiveDeals /> : <HistoryDeals />}
    </>
  );
}
