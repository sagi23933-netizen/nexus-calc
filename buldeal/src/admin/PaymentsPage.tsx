import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CircleX, Coins, CreditCard, Receipt, RotateCcw, Search, TrendingUp, Undo2, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api, errMsg, qs } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { compact, dateTime, money, TOKEN_TYPE } from '../lib/format';
import type { Payment, TokenTx } from '../lib/types';
import { CHART_DARK, SERIES_DARK } from '../shared/charts';
import { Button, Confirm, Empty, Input, Pagination, Skeleton, StatusBadge, Tabs, cx } from '../shared/ui';
import { useToast } from '../shared/Toast';
import { ChartTooltip, PageHeader, Panel, StatTile } from './kit';
import { DarkSelect, dayIL } from './parts';

interface PaymentsRes {
  items: Payment[];
  total: number;
  page: number;
  size: number;
  summary: { paid: number; refunded: number; failed: number | null; vat: number };
  monthly: { month: string; amount: number; count: number }[];
}
interface TokensRes {
  items: TokenTx[];
  total: number;
  page: number;
  size: number;
  summary: { granted: number; used: number; outstanding: number };
}

const KIND: Record<string, string> = { subscription: 'מנוי', renewal: 'חידוש', tokens: 'טוקנים' };
const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  return `${MONTHS[Number(mm) - 1]} ${y.slice(2)}`;
};

export default function PaymentsPage() {
  const [tab, setTab] = useState<'payments' | 'tokens'>('payments');
  return (
    <div>
      <PageHeader title="תשלומים וטוקנים" subtitle="כל החיובים, החידושים, הזיכויים ותנועות הטוקנים במערכת" icon={<Wallet size={22} />} actions={<Tabs dark value={tab} onChange={setTab} tabs={[{ value: 'payments', label: 'תשלומים' }, { value: 'tokens', label: 'ספר טוקנים' }]} />} />
      {tab === 'payments' ? <PaymentsTab /> : <TokensTab />}
    </div>
  );
}

function PaymentsTab() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 350);
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useApi<PaymentsRes>(`/admin/payments${qs({ status, kind, q: dq, page, size: 25 })}`);
  const [refund, setRefund] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);

  // last 12 calendar months (Israel time), zero-filled
  const monthly = useMemo(() => {
    const byMonth = new Map((data?.monthly ?? []).map((m) => [m.month, m]));
    const [y, m] = dayIL().split('-').map(Number);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
      const key = d.toISOString().slice(0, 7);
      return { month: key, amount: byMonth.get(key)?.amount ?? 0, count: byMonth.get(key)?.count ?? 0, label: monthLabel(key) };
    });
  }, [data]);
  const s = data?.summary;
  const thisMonth = monthly[11];
  const lastMonth = monthly[10];

  const doRefund = async () => {
    if (!refund) return;
    setBusy(true);
    try {
      await api.post(`/admin/payments/${refund.id}/refund`);
      toast('הזיכוי נרשם והעסק קיבל הודעה');
      setRefund(null);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!s ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[112px] !rounded-3xl" />)
        ) : (
          <>
            <StatTile label="הכנסות (כולל מע״מ)" value={money(s.paid)} icon={<TrendingUp size={20} />} tone="lime" hint={`החודש: ${money(thisMonth.amount)}`} delta={lastMonth.amount ? ((thisMonth.amount - lastMonth.amount) / lastMonth.amount) * 100 : null} />
            <StatTile label="מתוכן מע״מ" value={money(s.vat)} icon={<Receipt size={20} />} tone="sky" hint="לדיווח" />
            <StatTile label="זיכויים" value={money(s.refunded)} icon={<Undo2 size={20} />} tone="amber" />
            <StatTile label="חיובים שנכשלו" value={(s.failed ?? 0).toLocaleString('he-IL')} icon={<CircleX size={20} />} tone="red" hint="כולל ניסיונות חידוש" />
          </>
        )}
      </div>

      <Panel title="הכנסות חודשיות" subtitle="12 החודשים האחרונים · תשלומים שבוצעו" className="mb-5">
        <div className="h-[240px]" dir="ltr">
          {loading && !data ? (
            <Skeleton className="h-full" />
          ) : !monthly.some((m) => m.amount > 0) ? (
            <Empty dark title="אין עדיין תשלומים" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 18, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid stroke={CHART_DARK.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CHART_DARK.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART_DARK.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₪${compact(v)}`} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => money(v)} />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="amount" name="הכנסות" fill={SERIES_DARK[0]} radius={[4, 4, 0, 0]} maxBarSize={44} label={{ position: 'top', fill: CHART_DARK.muted, fontSize: 11, formatter: (v: unknown) => (Number(v) ? `₪${compact(Number(v))}` : '') }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <Panel
        padded={false}
        title="תשלומים"
        subtitle={data ? `${data.total.toLocaleString('he-IL')} רשומות` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <Input dark className="!py-2 pr-9 text-sm" placeholder="עסק / חשבונית / אסמכתא" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
            </div>
            <DarkSelect className="!w-36 !py-2 text-sm" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
              <option value="">כל הסטטוסים</option>
              <option value="paid">שולם</option>
              <option value="failed">נכשל</option>
              <option value="refunded">זוכה</option>
            </DarkSelect>
            <DarkSelect className="!w-32 !py-2 text-sm" value={kind} onChange={(e) => (setKind(e.target.value), setPage(1))}>
              <option value="">כל הסוגים</option>
              <option value="subscription">מנוי</option>
              <option value="renewal">חידוש</option>
              <option value="tokens">טוקנים</option>
            </DarkSelect>
          </div>
        }
      >
        {loading && !data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <Empty dark title="לא נמצאו תשלומים" icon={<CreditCard size={26} />} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>חשבונית</th>
                    <th>תאריך</th>
                    <th>עסק</th>
                    <th>תיאור</th>
                    <th>סוג</th>
                    <th className="text-left">סכום</th>
                    <th>סטטוס</th>
                    <th>כרטיס</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap font-mono text-xs text-ink-300" dir="ltr">
                        {p.invoice_number || `#${p.id}`}
                      </td>
                      <td className="whitespace-nowrap text-ink-300">{dateTime(p.created_at)}</td>
                      <td>
                        <Link to={`/admin/businesses/${p.business_id}`} className="font-semibold text-white hover:text-lime-300">
                          {p.business}
                        </Link>
                      </td>
                      <td className="max-w-[240px] text-ink-300">
                        <div className="truncate">{p.description}</div>
                        {p.status === 'failed' && p.failure_reason && <div className="truncate text-[11px] text-red-300">{p.failure_reason}</div>}
                      </td>
                      <td>
                        <span className="chip bg-white/5 text-ink-200">{KIND[p.kind] || p.kind}</span>
                      </td>
                      <td className={cx('whitespace-nowrap text-left font-bold tabular-nums', p.status === 'refunded' ? 'text-ink-400 line-through' : p.status === 'failed' ? 'text-ink-500' : 'text-white')}>{money(p.amount)}</td>
                      <td>
                        <StatusBadge dark status={p.status} />
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs text-ink-400">
                        <span dir="ltr">{p.card_last4 ? `•••• ${p.card_last4}` : '—'}</span>
                        <div className="text-[10px] text-ink-500">{p.provider}</div>
                      </td>
                      <td>
                        {p.status === 'paid' && (
                          <Button size="sm" variant="a-ghost" className="a-btn-ghost" icon={<RotateCcw size={13} />} onClick={() => setRefund(p)}>
                            זיכוי
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pagination dark page={data.page} size={data.size} total={data.total} onPage={setPage} />}
          </>
        )}
      </Panel>

      <Confirm
        dark
        danger
        open={!!refund}
        onClose={() => setRefund(null)}
        onConfirm={doRefund}
        loading={busy}
        title="זיכוי תשלום"
        confirmText="ביצוע זיכוי"
        body={
          refund && (
            <div className="space-y-2">
              <p>
                לזכות את <b className="text-white">{refund.business}</b> בסך <b className="text-white">{money(refund.amount)}</b> עבור ״{refund.description}״?
              </p>
              <p className="text-xs text-ink-400">התשלום יסומן כמזוכה והעסק יקבל התראה. בספק סליקה אמיתי יש לבצע גם את ההחזר בפועל במסוף. הטוקנים שהוקצו אינם מבוטלים אוטומטית — ניתן להפחית אותם מכרטיס העסק.</p>
            </div>
          )
        }
      />
    </>
  );
}

function TokensTab() {
  const [page, setPage] = useState(1);
  const { data, loading } = useApi<TokensRes>(`/admin/tokens${qs({ page, size: 40 })}`);
  const s = data?.summary;
  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {!s ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[112px] !rounded-3xl" />)
        ) : (
          <>
            <StatTile label="טוקנים שהוקצו" value={s.granted.toLocaleString('he-IL')} icon={<ArrowDownLeft size={20} />} tone="lime" hint="חבילות, רכישות, מתנות וטוקנים יומיים" />
            <StatTile label="טוקנים שנוצלו" value={s.used.toLocaleString('he-IL')} icon={<ArrowUpRight size={20} />} tone="wood" hint="פרסומי דילים" />
            <StatTile label="יתרה פתוחה בחשבונות" value={s.outstanding.toLocaleString('he-IL')} icon={<Coins size={20} />} tone="amber" hint="לא כולל טוקנים יומיים" />
          </>
        )}
      </div>
      <Panel padded={false} title="תנועות טוקנים" subtitle={data ? `${data.total.toLocaleString('he-IL')} תנועות` : undefined}>
        {loading && !data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <Empty dark title="אין תנועות" icon={<Coins size={26} />} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>זמן</th>
                    <th>עסק</th>
                    <th>סוג</th>
                    <th>פירוט</th>
                    <th className="text-center">כמות</th>
                    <th className="text-center">יתרה אחרי</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap text-ink-300">{dateTime(t.created_at)}</td>
                      <td>
                        <Link to={`/admin/businesses/${t.business_id}`} className="font-semibold text-white hover:text-lime-300">
                          {t.business}
                        </Link>
                      </td>
                      <td>
                        <span className="chip bg-white/5 text-ink-200">
                          {TOKEN_TYPE[t.type] || t.type}
                          {t.pool === 'daily' && <span className="text-sky-300">· יומי</span>}
                        </span>
                      </td>
                      <td className="max-w-[280px] truncate text-ink-300">{t.note}</td>
                      <td className={cx('text-center font-bold tabular-nums', t.amount > 0 ? 'text-lime-300' : 'text-wood-300')} dir="ltr">
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </td>
                      <td className="text-center tabular-nums text-ink-300">{t.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pagination dark page={data.page} size={data.size} total={data.total} onPage={setPage} />}
          </>
        )}
      </Panel>
    </>
  );
}
