import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, Building2, Coins, Filter, Plus, Search, X } from 'lucide-react';
import { useApi, useDebounced } from '../lib/hooks';
import { qs } from '../lib/api';
import { daysLeft, date, num } from '../lib/format';
import { Avatar, Button, Empty, Pagination, Skeleton, StatusBadge, cx } from '../shared/ui';
import { PageHeader, Panel } from './kit';
import { CreateBusinessModal } from './core/CreateBusinessModal';
import { SourceBadge, TableWrap, useLookups, DSelect } from './core/shared';

interface Row {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  status: string;
  source: 'site' | 'admin';
  phone: string;
  trial_ends_at: string | null;
  period_end: string | null;
  token_balance: number;
  daily_tokens: number;
  created_at: string;
  email: string;
  owner: string;
  category: string | null;
  city: string | null;
  package_name: string | null;
  live_deals: number;
}

function SortTh({ k, sort, onSort, children }: { k: string; sort: string; onSort: (k: string) => void; children: ReactNode }) {
  return (
    <th>
      <button onClick={() => onSort(k)} className={cx('inline-flex items-center gap-1 hover:text-white', sort === k && 'text-lime-300')}>
        {children}
        <ArrowDownUp size={12} className="opacity-60" />
      </button>
    </th>
  );
}

const STATUSES = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'trial', label: 'תקופת ניסיון' },
  { value: 'active', label: 'פעיל' },
  { value: 'past_due', label: 'ממתין לתשלום' },
  { value: 'blocked', label: 'חסום' },
  { value: 'suspended', label: 'מושעה' },
];

export default function BusinessesPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { categories, cities } = useLookups();
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounced(q, 350);
  const [creating, setCreating] = useState(false);

  const status = sp.get('status') || '';
  const city = sp.get('city') || '';
  const category = sp.get('category') || '';
  const source = sp.get('source') || '';
  const sort = sp.get('sort') || 'created';
  const page = Number(sp.get('page')) || 1;

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setSp(next, { replace: true });
  };

  useEffect(() => {
    if ((sp.get('q') || '') !== dq) update({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  useEffect(() => {
    setQ(sp.get('q') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get('q')]);

  const url = `/admin/businesses${qs({ q: sp.get('q'), status, city, category, source, sort, page, size: 25 })}`;
  const { data, loading, reload } = useApi<{ items: Row[]; total: number; page: number; size: number }>(url);
  const filtersOn = !!(status || city || category || source || sp.get('q'));

  return (
    <>
      <PageHeader
        title="עסקים"
        subtitle={data ? `${num(data.total)} עסקים תואמים` : 'ניהול כל העסקים במערכת'}
        icon={<Building2 size={22} />}
        actions={
          <Button icon={<Plus size={17} />} onClick={() => setCreating(true)}>
            עסק חדש
          </Button>
        }
      />

      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/5 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input className="a-input !pr-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם, בעלים, אימייל או טלפון" />
          </div>
          <Filter size={16} className="hidden text-ink-500 sm:block" />
          <DSelect className="!w-auto min-w-[150px]" value={status} onChange={(e) => update({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </DSelect>
          <DSelect className="!w-auto min-w-[140px]" value={city} onChange={(e) => update({ city: e.target.value })}>
            <option value="">כל הערים</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DSelect>
          <DSelect className="!w-auto min-w-[150px]" value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DSelect>
          <DSelect className="!w-auto min-w-[140px]" value={source} onChange={(e) => update({ source: e.target.value })}>
            <option value="">כל המקורות</option>
            <option value="site">הרשמה באתר</option>
            <option value="admin">נפתח ע״י מנהל</option>
          </DSelect>
          {filtersOn && (
            <Button variant="a-ghost" size="sm" icon={<X size={15} />} onClick={() => setSp(new URLSearchParams(), { replace: true })}>
              ניקוי
            </Button>
          )}
        </div>

        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <Empty dark icon={<Building2 size={26} />} title="לא נמצאו עסקים" text={filtersOn ? 'נסו לשנות את הסינון' : 'עוד לא נרשמו עסקים'} />
        ) : (
          <>
            <TableWrap>
              <table className="a-table min-w-[1100px]">
                <thead>
                  <tr>
                    <SortTh k="name" sort={sort} onSort={(k) => update({ sort: k })}>עסק</SortTh>
                    <th>בעלים</th>
                    <th>קטגוריה · עיר</th>
                    <th>חבילה</th>
                    <th>סטטוס</th>
                    <SortTh k="trial" sort={sort} onSort={(k) => update({ sort: k })}>ניסיון / מנוי עד</SortTh>
                    <SortTh k="tokens" sort={sort} onSort={(k) => update({ sort: k })}>טוקנים</SortTh>
                    <th>דילים</th>
                    <SortTh k="created" sort={sort} onSort={(k) => update({ sort: k })}>הצטרף</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((b) => {
                    const end = b.status === 'trial' ? b.trial_ends_at : b.period_end;
                    const left = daysLeft(end);
                    return (
                      <tr key={b.id} className="cursor-pointer" onClick={() => nav(`/admin/businesses/${b.id}`)}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar src={b.logo_url} name={b.name} size={38} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-white">{b.name}</div>
                              <SourceBadge source={b.source} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-ink-100">{b.owner}</div>
                          <div className="text-xs text-ink-400" dir="ltr" style={{ textAlign: 'right' }}>
                            {b.email}
                          </div>
                          <div className="text-xs text-ink-500" dir="ltr" style={{ textAlign: 'right' }}>
                            {b.phone}
                          </div>
                        </td>
                        <td className="text-ink-300">
                          <div>{b.category || '—'}</div>
                          <div className="text-xs text-ink-500">{b.city || '—'}</div>
                        </td>
                        <td className="text-ink-200">{b.package_name || <span className="text-ink-500">לא נבחרה</span>}</td>
                        <td>
                          <StatusBadge status={b.status} dark />
                        </td>
                        <td>
                          {end ? (
                            <>
                              <div className="text-ink-200">{date(end)}</div>
                              {['trial', 'active'].includes(b.status) && <div className={cx('text-xs', left <= 1 ? 'font-bold text-red-300' : 'text-ink-500')}>{left > 0 ? `עוד ${left} ימים` : 'היום'}</div>}
                            </>
                          ) : (
                            <span className="text-ink-500">—</span>
                          )}
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1 font-bold tabular-nums text-white">
                            <Coins size={14} className="text-amber-300" />
                            {b.token_balance}
                          </span>
                          {b.status === 'trial' && <div className="text-[11px] text-ink-500">+{b.daily_tokens} יומי</div>}
                        </td>
                        <td>
                          <span className={cx('chip', b.live_deals ? 'bg-lime-400/10 text-lime-300' : 'bg-white/5 text-ink-500')}>{b.live_deals} באוויר</span>
                        </td>
                        <td className="whitespace-nowrap text-ink-400">{date(b.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <div className="border-t border-white/5 px-3">
              <Pagination dark page={page} total={data.total} size={data.size} onPage={(p) => update({ page: String(p) })} />
            </div>
          </>
        )}
      </Panel>

      <CreateBusinessModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </>
  );
}
